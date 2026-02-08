import { Component, Inject, PLATFORM_ID, OnInit, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { Firestore, collection, query, where, getDocs, doc, updateDoc } from '@angular/fire/firestore';
import { AuthService } from '../services/auth.service';
import { Profissional } from '../interfaces/profissional.interface';
import { ProfissionalService } from '../services/profissional.service';
import { BloqueioService } from '../services/bloqueio.service';
import { BloqueioHorario } from '../interfaces/bloqueio.interface';

interface ViewOption {
  label: string;
  value: string;
}

interface Agendamento {
  id?: string;
  salonId: string;
  profissionalId?: string;      // Profissional responsável (pode ser undefined para agendamentos legado)
  profissionalNome?: string;    // Nome do profissional (denormalizado)
  clienteNome: string;
  clienteTelefone: string;
  servicos: { id: string; nome: string; valor: number; duracao: number }[];
  data: string;
  horaInicio: string;
  horaFim: string;
  status: 'pendente' | 'confirmado' | 'cancelado' | 'realizado' | 'no-show';
  valorTotal: number;
  duracaoTotal: number;
  createdAt: any;
}

type AppointmentStatus = 'confirmed' | 'pending' | 'declined' | 'blocked' | 'completed' | 'no-show';

interface Appointment {
  id: string;
  client: string;
  service: string;
  startTime: string;
  endTime: string;
  date: Date; // Data real do agendamento
  status: AppointmentStatus;
  image: string;
  price: string;
  profissionalId?: string;      // ID do profissional
  profissionalNome?: string;    // Nome do profissional
  clientPhone?: string;         // Telefone do cliente para lembretes
  services?: { id: string; nome: string; valor: number; duracao: number }[];
}

interface DailySummary {
  confirmed: number;
  pending: number;
  declined: number;
  revenue: string;
}

interface CalendarDay {
  date: Date;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  appointments: Appointment[];
}

interface MonthlySummary {
  totalAppointments: number;
  confirmed: number;
  pending: number;
  declined: number;
  revenue: string;
}

@Component({
  selector: 'app-agenda',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectModule, TooltipModule],
  templateUrl: './agenda.component.html',
  styleUrls: ['./agenda.component.css']
})
export class AgendaComponent implements OnInit {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private profissionalService = inject(ProfissionalService);
  private bloqueioService = inject(BloqueioService);

  isBrowser: boolean;
  currentView = 'daily';
  isLoading = true;
  allAgendamentos: Agendamento[] = [];
  isDayModalOpen = false;
  modalDay: Date | null = null;
  isBlockModalOpen = false;
  isSavingBloqueio = false;
  blockModalError = '';
  bloqueios: BloqueioHorario[] = [];
  isReminderModalOpen = false;
  reminderModalDate: Date | null = null;
  selectedReminderIds: Set<string> = new Set<string>();
  isAppointmentModalOpen = false;
  selectedAppointment: Appointment | null = null;
  isUpdatingStatus = false;
  statusUpdateError = '';
  statusUpdateSuccess = '';
  isCancellingAppointment = false;
  cancelAppointmentError = '';
  cancelAppointmentSuccess = '';

  // Profissionais e filtro
  profissionais: Profissional[] = [];
  profissionalFiltro: string | null = null;  // null = "Todos"
  profissionalOptions: { label: string; value: string | null }[] = [
    { label: 'Todos os profissionais', value: null }
  ];
  
  // Opções de visualização
  viewOptions: ViewOption[] = [
    { label: 'Visão Semanal', value: 'weekly' },
    { label: 'Visão Mensal', value: 'monthly' },
    { label: 'Visão Diária', value: 'daily' }
  ];
  selectedView: ViewOption = this.viewOptions[2]; // Visão Diária como padrão
  
  // Data atual da semana
  currentWeekStart = new Date(2024, 10, 18); // 18 de novembro de 2024 (segunda-feira)
  
  // Data atual para visão diária
  currentDay = new Date(2024, 10, 21); // 21 de novembro de 2024 (quinta-feira)
  
  // Horários do dia
  timeSlots = ['08:00', '10:00', '12:00', '14:00', '16:00'];
  
  // Dias da semana
  weekDays = [
    { name: 'SEG', short: 'SEG' },
    { name: 'TER', short: 'TER' },
    { name: 'QUA', short: 'QUA' },
    { name: 'QUI', short: 'QUI' },
    { name: 'SEX', short: 'SEX' },
    { name: 'SAB', short: 'SAB' },
    { name: 'DOM', short: 'DOM' }
  ];

  // Nomes dos dias da semana em português
  dayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  // Agendamentos
  appointments: Appointment[] = [];

  blockForm = {
    data: '',
    horaInicio: '09:00',
    horaFim: '10:00',
    aplicaParaTodos: true,
    profissionalId: null as string | null,
    motivo: ''
  };
  isSendingReminder = false;
  reminderSuccess = '';
  reminderError = '';

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  async ngOnInit(): Promise<void> {
    if (this.isBrowser) {
      // Inicializar a data atual
      this.currentDay = new Date();
      this.currentWeekStart = this.getMonday(new Date());
      this.currentMonth = new Date();

      // Carregar profissionais e agendamentos em paralelo
      await Promise.all([
        this.carregarProfissionais(),
        this.carregarAgendamentos()
      ]);
    }
  }

  /**
   * Carregar profissionais do salão
   */
  async carregarProfissionais(): Promise<void> {
    try {
      const currentUser = this.authService.currentUser();
      if (!currentUser) return;

      this.profissionais = await this.profissionalService.listarPorSalao(currentUser.uid);
      this.profissionalOptions = [
        { label: 'Todos os profissionais', value: null },
        ...this.profissionais.map(prof => ({ label: prof.nome, value: prof.id || null }))
      ];
      console.log(`Carregados ${this.profissionais.length} profissionais`);
    } catch (error) {
      console.error('Erro ao carregar profissionais:', error);
    }
  }

  /**
   * Obter a segunda-feira da semana atual
   */
  private getMonday(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  /**
   * Carregar agendamentos do Firestore com filtro opcional de profissional
   */
  async carregarAgendamentos(): Promise<void> {
    try {
      this.isLoading = true;
      const currentUser = this.authService.currentUser();

      if (!currentUser) {
        console.error('Usuário não autenticado');
        this.isLoading = false;
        return;
      }

      console.log('Carregando agendamentos para o usuário:', currentUser.uid);

      const agendamentosRef = collection(this.firestore, 'agendamentos');

      // Construir query com filtro opcional de profissional
      let q = query(
        agendamentosRef,
        where('salonId', '==', currentUser.uid)
      );

      // Adicionar filtro de profissional se selecionado
      if (this.profissionalFiltro) {
        q = query(q, where('profissionalId', '==', this.profissionalFiltro));
        console.log('Filtrando por profissional:', this.profissionalFiltro);
      }

      const [snapshot, bloqueios] = await Promise.all([
        getDocs(q),
        this.bloqueioService.listarPorSalao(currentUser.uid)
      ]);

      console.log(`Encontrados ${snapshot.docs.length} agendamentos no Firebase`);

      this.allAgendamentos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Agendamento & { id: string }));

      this.bloqueios = this.filtrarBloqueiosPorProfissional(bloqueios);

      // Ordenar localmente por data
      this.allAgendamentos.sort((a, b) => {
        const dateA = new Date(a.data);
        const dateB = new Date(b.data);
        return dateA.getTime() - dateB.getTime();
      });

      console.log('Agendamentos ordenados:', this.allAgendamentos.length);

      // Converter para o formato Appointment
      const agendamentoAppointments = this.allAgendamentos.map(agend => this.convertToAppointment(agend));
      const bloqueioAppointments = this.bloqueios.map(bloqueio => this.convertBloqueioToAppointment(bloqueio));

      this.appointments = this.sortAppointments([...agendamentoAppointments, ...bloqueioAppointments]);
      this.closeReminderModal();
      this.selectedReminderIds.clear();
      this.reminderSuccess = '';
      this.reminderError = '';

      console.log('Appointments convertidos:', this.appointments.length);

      // Forçar atualização do calendário
      this._lastMonthKey = '';

      this.isLoading = false;
    } catch (error) {
      console.error('Erro ao carregar agendamentos:', error);
      console.error('Detalhes do erro:', JSON.stringify(error, null, 2));
      this.isLoading = false;
    }
  }

  /**
   * Converter Agendamento do Firestore para Appointment
   */
  private convertToAppointment(agend: Agendamento & { id?: string }): Appointment {
    // Converter status
    const status = this.mapAgendamentoStatusToAppointmentStatus(agend.status);

    // Converter data string (YYYY-MM-DD) para Date
    const [year, month, day] = agend.data.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    // Pegar primeiro serviço ou concatenar múltiplos
    const service = agend.servicos.length === 1
      ? agend.servicos[0].nome
      : agend.servicos.map(s => s.nome).join(', ');

    // Formatar preço
    const price = `R$ ${agend.valorTotal.toFixed(2).replace('.', ',')}`;

    return {
      id: agend.id || '',
      client: agend.clienteNome,
      service: service,
      startTime: agend.horaInicio,
      endTime: agend.horaFim,
      date: date,
      status: status,
      image: '/girllandpage.png',
      price: price,
      profissionalId: agend.profissionalId,
      profissionalNome: agend.profissionalNome,
      clientPhone: agend.clienteTelefone,
      services: agend.servicos
    };
  }

  /**
   * Converter Bloqueio do Firestore para Appointment (para exibição)
   */
  private convertBloqueioToAppointment(bloqueio: BloqueioHorario): Appointment {
    const [year, month, day] = bloqueio.data.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    const professionalLabel = bloqueio.aplicaParaTodos
      ? 'Todos os profissionais'
      : (bloqueio.profissionalNome || 'Profissional');

    return {
      id: bloqueio.id || `bloqueio-${bloqueio.data}-${bloqueio.horaInicio}`,
      client: 'Horário bloqueado',
      service: bloqueio.motivo?.trim() || 'Indisponível para agendamento',
      startTime: bloqueio.horaInicio,
      endTime: bloqueio.horaFim,
      date,
      status: 'blocked',
      image: '/girllandpage.png',
      price: 'Indisponível',
      profissionalId: bloqueio.profissionalId || undefined,
      profissionalNome: professionalLabel
    };
  }

  /**
   * Ordenar appointments por data e horário
   */
  private sortAppointments(appointments: Appointment[]): Appointment[] {
    return [...appointments].sort((a, b) => {
      const dateDiff = a.date.getTime() - b.date.getTime();
      if (dateDiff !== 0) return dateDiff;
      return this.timeStringToMinutes(a.startTime) - this.timeStringToMinutes(b.startTime);
    });
  }

  private filtrarBloqueiosPorProfissional(bloqueios: BloqueioHorario[]): BloqueioHorario[] {
    if (!this.profissionalFiltro) return bloqueios;
    return bloqueios.filter(b => b.aplicaParaTodos || b.profissionalId === this.profissionalFiltro);
  }

  // ==================== VISÃO SEMANAL ====================
  
  get weekNumber(): number {
    const startOfYear = new Date(this.currentWeekStart.getFullYear(), 0, 1);
    const days = Math.floor((this.currentWeekStart.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + startOfYear.getDay() + 1) / 7);
  }

  get weekDateRange(): string {
    const start = this.currentWeekStart;
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    
    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()} - ${end.getDate()} ${this.monthNames[start.getMonth()]} ${start.getFullYear()}`;
    } else {
      return `${start.getDate()} ${this.monthNames[start.getMonth()]} - ${end.getDate()} ${this.monthNames[end.getMonth()]} ${end.getFullYear()}`;
    }
  }

  getDayDate(dayIndex: number): number {
    const date = new Date(this.currentWeekStart);
    date.setDate(date.getDate() + dayIndex);
    return date.getDate();
  }

  previousWeek(): void {
    this.currentWeekStart.setDate(this.currentWeekStart.getDate() - 7);
    this.currentWeekStart = new Date(this.currentWeekStart);
  }

  nextWeek(): void {
    this.currentWeekStart.setDate(this.currentWeekStart.getDate() + 7);
    this.currentWeekStart = new Date(this.currentWeekStart);
  }

  getAppointmentsForSlot(timeSlot: string, dayIndex: number): Appointment[] {
    const slotHour = parseInt(timeSlot.split(':')[0]);
    
    // Calcular a data do dia específico da semana
    const targetDate = new Date(this.currentWeekStart);
    targetDate.setDate(targetDate.getDate() + dayIndex);
    
    return this.appointments.filter(appt => {
      // Verificar se é o mesmo dia
      if (appt.date.toDateString() !== targetDate.toDateString()) return false;
      
      const apptStartHour = parseInt(appt.startTime.split(':')[0]);
      
      // Verifica se o agendamento começa neste slot ou continua nele
      return apptStartHour >= slotHour && apptStartHour < slotHour + 2;
    });
  }

  // ==================== VISÃO DIÁRIA ====================

  get currentDayFormatted(): string {
    return this.formatDateLabel(this.currentDay);
  }

  get modalDayFormatted(): string {
    return this.formatDateLabel(this.modalDay || this.currentDay);
  }

  get modalDayOfWeek(): string {
    return this.dayNames[(this.modalDay || this.currentDay).getDay()];
  }

  get currentDayOfWeek(): string {
    return this.dayNames[this.currentDay.getDay()];
  }

  formatDateLabel(date: Date): string {
    const day = date.getDate();
    const month = this.monthNames[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  }

  get dailySummary(): DailySummary {
    return this.getDailySummary(this.currentDay);
  }

  getDailySummary(date: Date): DailySummary {
    const dailyAppts = this.getDailyAppointments(date);
    const confirmed = dailyAppts.filter(a => a.status === 'confirmed' || a.status === 'completed').length;
    const pending = dailyAppts.filter(a => a.status === 'pending').length;
    const declined = dailyAppts.filter(a => a.status === 'declined' || a.status === 'no-show').length;
    
    // Calcular faturamento (apenas confirmados e pendentes)
    const revenue = dailyAppts
      .filter(a => a.status === 'confirmed' || a.status === 'pending' || a.status === 'completed')
      .reduce((sum, appt) => {
        const priceValue = parseFloat(appt.price.replace('R$ ', '').replace('.', '').replace(',', '.'));
        return sum + priceValue;
      }, 0);

    return {
      confirmed,
      pending,
      declined,
      revenue: `R$ ${revenue.toFixed(2).replace('.', ',')}`
    };
  }

  previousDay(): void {
    const newDay = new Date(this.modalDay || this.currentDay);
    newDay.setDate(newDay.getDate() - 1);
    this.currentDay = newDay;
    this.modalDay = newDay;
    this.selectedReminderIds.clear();
    this.closeReminderModal();
    this.reminderSuccess = '';
    this.reminderError = '';
  }

  nextDay(): void {
    const newDay = new Date(this.modalDay || this.currentDay);
    newDay.setDate(newDay.getDate() + 1);
    this.currentDay = newDay;
    this.modalDay = newDay;
    this.selectedReminderIds.clear();
    this.closeReminderModal();
    this.reminderSuccess = '';
    this.reminderError = '';
  }

  getDailyAppointments(date: Date = this.currentDay): Appointment[] {
    return this.appointments
      .filter(appt => appt.date.toDateString() === date.toDateString())
      .sort((a, b) => {
        const timeA = parseInt(a.startTime.replace(':', ''));
        const timeB = parseInt(b.startTime.replace(':', ''));
        return timeA - timeB;
      });
  }

  getDuration(appt: Appointment): number {
    const [startHour, startMin] = appt.startTime.split(':').map(Number);
    const [endHour, endMin] = appt.endTime.split(':').map(Number);
    return (endHour * 60 + endMin) - (startHour * 60 + startMin);
  }

  shouldShowLunchBreak(appointments: Appointment[], index: number): boolean {
    const nextAppt = appointments[index + 1];
    
    if (!nextAppt) return false;
    
    const currentEndHour = parseInt(appointments[index].endTime.split(':')[0]);
    const nextStartHour = parseInt(nextAppt.startTime.split(':')[0]);
    
    // Mostrar intervalo de almoço se o atual termina antes das 13h e o próximo começa após 12h
    return currentEndHour <= 12 && nextStartHour >= 13;
  }

  // ==================== VISÃO MENSAL ====================

  currentMonth = new Date(2024, 10, 1); // Novembro de 2024
  monthNamesFull = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  calendarWeekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  
  // Cache para os dias do calendário
  private _calendarDays: CalendarDay[] = [];
  private _lastMonthKey = '';

  get currentMonthFormatted(): string {
    return `${this.monthNamesFull[this.currentMonth.getMonth()]} ${this.currentMonth.getFullYear()}`;
  }

  get daysInCurrentMonth(): number {
    return new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 0).getDate();
  }

  get calendarDays(): CalendarDay[] {
    const monthKey = `${this.currentMonth.getFullYear()}-${this.currentMonth.getMonth()}`;
    if (this._lastMonthKey === monthKey && this._calendarDays.length > 0) {
      return this._calendarDays;
    }
    this._lastMonthKey = monthKey;
    this._calendarDays = this.generateCalendarDays();
    return this._calendarDays;
  }

  private generateCalendarDays(): CalendarDay[] {
    const days: CalendarDay[] = [];
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startingDay = firstDay.getDay();
    const prevMonth = new Date(year, month, 0);
    const prevMonthDays = prevMonth.getDate();
    
    // Dias do mês anterior
    for (let i = startingDay - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthDays - i);
      const appts = this.appointments.filter(a => a.date.toDateString() === date.toDateString());
      days.push({ date, day: prevMonthDays - i, isCurrentMonth: false, isToday: false, appointments: appts });
    }
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    
    // Dias do mês atual
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      const isToday = date.toDateString() === today.toDateString();
      const appts = this.appointments.filter(a => a.date.toDateString() === date.toDateString());
      days.push({ date, day: i, isCurrentMonth: true, isToday, appointments: appts });
    }
    
    // Dias do próximo mês
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(year, month + 1, i);
      const appts = this.appointments.filter(a => a.date.toDateString() === date.toDateString());
      days.push({ date, day: i, isCurrentMonth: false, isToday: false, appointments: appts });
    }
    
    return days;
  }

  get monthlySummaryData(): MonthlySummary {
    // Filtrar agendamentos do mês atual
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();
    
    const monthlyAppts = this.appointments
      .filter(appt => appt.status !== 'blocked')
      .filter(appt => appt.date.getFullYear() === year && appt.date.getMonth() === month);

    const confirmed = monthlyAppts.filter(a => a.status === 'confirmed' || a.status === 'completed').length;
    const pending = monthlyAppts.filter(a => a.status === 'pending').length;
    const declined = monthlyAppts.filter(a => a.status === 'declined' || a.status === 'no-show').length;
    
    // Calcular faturamento (apenas confirmados e pendentes)
    const revenue = monthlyAppts
      .filter(a => a.status === 'confirmed' || a.status === 'pending' || a.status === 'completed')
      .reduce((sum, appt) => {
        const priceValue = parseFloat(appt.price.replace('R$ ', '').replace('.', '').replace(',', '.'));
        return sum + priceValue;
      }, 0);

    return {
      totalAppointments: monthlyAppts.length,
      confirmed,
      pending,
      declined,
      revenue: `R$ ${revenue.toFixed(2).replace('.', ',')}`
    };
  }

  previousMonth(): void {
    const newMonth = new Date(this.currentMonth);
    newMonth.setMonth(newMonth.getMonth() - 1);
    this.currentMonth = newMonth;
    this._lastMonthKey = ''; // Force recalculation
  }

  nextMonth(): void {
    const newMonth = new Date(this.currentMonth);
    newMonth.setMonth(newMonth.getMonth() + 1);
    this.currentMonth = newMonth;
    this._lastMonthKey = ''; // Force recalculation
  }

  getConfirmedCount(appointments: Appointment[]): number {
    return appointments.filter(a => a.status === 'confirmed' || a.status === 'completed').length;
  }

  getPendingCount(appointments: Appointment[]): number {
    return appointments.filter(a => a.status === 'pending').length;
  }

  getActiveAppointmentsCount(appointments: Appointment[]): number {
    return appointments.filter(a => a.status !== 'blocked').length;
  }

  hasBlockedAppointments(appointments: Appointment[]): boolean {
    return appointments.some(a => a.status === 'blocked');
  }

  // ==================== UTILITÁRIOS ====================

  getStatusClass(status: string): string {
    switch (status) {
      case 'confirmed': return 'status-confirmed';
      case 'pending': return 'status-pending';
      case 'declined': return 'status-declined';
      case 'completed': return 'status-completed';
      case 'no-show': return 'status-no-show';
      case 'blocked': return 'status-blocked';
      default: return '';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'confirmed': return 'Confirmado';
      case 'pending': return 'Pendente';
      case 'declined': return 'Cancelado';
      case 'completed': return 'Realizado';
      case 'no-show': return 'No-show';
      case 'blocked': return 'Bloqueado';
      default: return '';
    }
  }

  onViewChange(): void {
    this.currentView = this.selectedView.value;
  }

  changeView(view: string): void {
    this.currentView = view;
  }

  // ==================== FILTRO DE PROFISSIONAL ====================

  /**
   * Filtrar agendamentos por profissional
   */
  filtrarPorProfissional(profissionalId: string | null): void {
    this.profissionalFiltro = profissionalId;
    this.carregarAgendamentos();
  }

  /**
   * Limpar filtro de profissional
   */
  limparFiltro(): void {
    this.profissionalFiltro = null;
    this.carregarAgendamentos();
  }

  /**
   * Abrir modal de detalhes do dia na visão mensal
   */
  openDayModal(day: CalendarDay): void {
    this.modalDay = new Date(day.date);
    this.currentDay = new Date(day.date);
    this.isDayModalOpen = true;
    this.closeReminderModal();
    this.selectedReminderIds.clear();
    this.reminderSuccess = '';
    this.reminderError = '';
  }

  /**
   * Fechar modal de detalhes do dia
   */
  closeDayModal(): void {
    this.isDayModalOpen = false;
    this.modalDay = null;
    this.closeReminderModal();
  }

  /**
   * Obter cor única por profissional
   */
  getProfissionalColor(profissionalId?: string): string {
    if (!profissionalId) return '#9E9E9E'; // Cinza para agendamentos sem profissional

    const index = this.profissionais.findIndex(p => p.id === profissionalId);
    if (index === -1) return '#9E9E9E';

    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#DDA15E', '#BC6C25'];
    return colors[index % colors.length];
  }

  private timeStringToMinutes(time: string): number {
    const [hour, minute] = time.split(':').map(Number);
    return hour * 60 + minute;
  }

  isDayInPast(date: Date): boolean {
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    return endOfDay.getTime() < Date.now();
  }

  get blockFormDateLabel(): string {
    if (!this.blockForm.data) return 'Selecione a data';
    const date = new Date(this.blockForm.data + 'T00:00:00');
    return this.formatDateLabel(date);
  }

  openBlockModal(date?: Date): void {
    const targetDate = date || this.modalDay || this.currentDay || new Date();
    this.resetBlockForm(targetDate);
    this.blockModalError = '';
    this.isBlockModalOpen = true;
  }

  closeBlockModal(): void {
    this.isBlockModalOpen = false;
  }

  private resetBlockForm(date: Date): void {
    this.blockForm = {
      data: this.formatDateInput(date),
      horaInicio: '09:00',
      horaFim: '10:00',
      aplicaParaTodos: true,
      profissionalId: null,
      motivo: ''
    };
  }

  onAplicaParaTodosChange(): void {
    if (this.blockForm.aplicaParaTodos) {
      this.blockForm.profissionalId = null;
    }
  }

  private formatDateInput(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  async salvarBloqueio(): Promise<void> {
    if (this.isSavingBloqueio) return;

    const currentUser = this.authService.currentUser();
    if (!currentUser) {
      this.blockModalError = 'Usuário não autenticado.';
      return;
    }

    if (!this.blockForm.data || !this.blockForm.horaInicio || !this.blockForm.horaFim) {
      this.blockModalError = 'Preencha a data e os horários do bloqueio.';
      return;
    }

    if (!this.blockForm.aplicaParaTodos && !this.blockForm.profissionalId) {
      this.blockModalError = 'Selecione um profissional ou marque o bloqueio para todo o salão.';
      return;
    }

    const inicioMinutos = this.timeStringToMinutes(this.blockForm.horaInicio);
    const fimMinutos = this.timeStringToMinutes(this.blockForm.horaFim);

    if (fimMinutos <= inicioMinutos) {
      this.blockModalError = 'O horário final deve ser maior que o horário inicial.';
      return;
    }

    const bloqueioFim = new Date(`${this.blockForm.data}T${this.blockForm.horaFim}:00`);
    if (bloqueioFim.getTime() <= Date.now()) {
      this.blockModalError = 'Não é possível bloquear horários que já passaram.';
      return;
    }

    const agendamentoConflitante = this.allAgendamentos.find(agend => {
      if (agend.status === 'cancelado') return false;
      if (agend.data !== this.blockForm.data) return false;
      if (!this.blockForm.aplicaParaTodos && agend.profissionalId !== this.blockForm.profissionalId) {
        return false;
      }
      const agendInicio = this.timeStringToMinutes(agend.horaInicio);
      const agendFim = this.timeStringToMinutes(agend.horaFim);
      return inicioMinutos < agendFim && fimMinutos > agendInicio;
    });

    if (agendamentoConflitante) {
      const profissionalInfo = agendamentoConflitante.profissionalNome
        ? ` (${agendamentoConflitante.profissionalNome})`
        : '';
      this.blockModalError = `Não é possível bloquear este horário porque já existe um agendamento das ${agendamentoConflitante.horaInicio} às ${agendamentoConflitante.horaFim} para ${agendamentoConflitante.clienteNome}${profissionalInfo}. Cancele ou reagende antes de bloquear.`;
      return;
    }

    const profissionalNome = this.blockForm.aplicaParaTodos
      ? undefined
      : this.profissionais.find(p => p.id === this.blockForm.profissionalId)?.nome;

    this.isSavingBloqueio = true;
    this.blockModalError = '';

    try {
      await this.bloqueioService.criar({
        salonId: currentUser.uid,
        aplicaParaTodos: this.blockForm.aplicaParaTodos,
        profissionalId: this.blockForm.aplicaParaTodos ? null : this.blockForm.profissionalId,
        profissionalNome: profissionalNome,
        data: this.blockForm.data,
        horaInicio: this.blockForm.horaInicio,
        horaFim: this.blockForm.horaFim,
        motivo: this.blockForm.motivo?.trim() || undefined
      });

      await this.carregarAgendamentos();
      this.closeBlockModal();
    } catch (error) {
      console.error('Erro ao salvar bloqueio:', error);
      this.blockModalError = 'Não foi possível salvar o bloqueio. Tente novamente.';
    } finally {
      this.isSavingBloqueio = false;
    }
  }

  openReminderModal(date?: Date): void {
    const targetDate = date ? new Date(date) : (this.modalDay ? new Date(this.modalDay) : new Date(this.currentDay));
    this.reminderModalDate = targetDate;
    const availableAppointments = this.getPendingReminderAppointments(targetDate);
    this.selectedReminderIds = new Set(availableAppointments.map(appt => appt.id).filter(Boolean));
    this.isReminderModalOpen = true;
    this.reminderError = '';
    this.reminderSuccess = '';
  }

  closeReminderModal(): void {
    this.isReminderModalOpen = false;
    this.reminderModalDate = null;
    this.selectedReminderIds.clear();
  }

  getPendingReminderAppointments(date: Date = this.currentDay): Appointment[] {
    return this.getDailyAppointments(date)
      .filter(appt =>
        appt.status !== 'blocked' &&
        appt.status !== 'declined' &&
        appt.status !== 'completed' &&
        appt.status !== 'no-show' &&
        !!appt.id &&
        !this.isAppointmentInPast(appt)
      );
  }

  isAppointmentSelected(appointmentId?: string): boolean {
    if (!appointmentId) return false;
    return this.selectedReminderIds.has(appointmentId);
  }

  toggleReminderSelection(appointmentId: string | undefined, checked: boolean): void {
    if (!appointmentId) return;
    if (checked) {
      this.selectedReminderIds.add(appointmentId);
    } else {
      this.selectedReminderIds.delete(appointmentId);
    }
  }

  private isAppointmentInPast(appt: Appointment): boolean {
    const now = new Date();
    const apptEnd = new Date(appt.date);
    const [endHour, endMinute] = appt.endTime.split(':').map(Number);
    apptEnd.setHours(endHour, endMinute, 0, 0);
    return apptEnd.getTime() <= now.getTime();
  }

  isPastAppointment(appt: Appointment | null): boolean {
    if (!appt) return false;
    return this.isAppointmentInPast(appt);
  }

  openAppointmentModal(appt: Appointment): void {
    if (appt.status === 'blocked') return;
    this.selectedAppointment = { ...appt };
    this.isAppointmentModalOpen = true;
    this.statusUpdateError = '';
    this.statusUpdateSuccess = '';
    this.cancelAppointmentError = '';
    this.cancelAppointmentSuccess = '';
  }

  closeAppointmentModal(): void {
    this.isAppointmentModalOpen = false;
    this.selectedAppointment = null;
    this.statusUpdateError = '';
    this.statusUpdateSuccess = '';
    this.cancelAppointmentError = '';
    this.cancelAppointmentSuccess = '';
  }

  private mapAgendamentoStatusToAppointmentStatus(status: Agendamento['status']): AppointmentStatus {
    switch (status) {
      case 'confirmado':
        return 'confirmed';
      case 'pendente':
        return 'pending';
      case 'realizado':
        return 'completed';
      case 'no-show':
        return 'no-show';
      case 'cancelado':
      default:
        return 'declined';
    }
  }

  async atualizarStatusAgendamento(novoStatus: 'realizado' | 'no-show'): Promise<void> {
    if (!this.selectedAppointment?.id || this.isUpdatingStatus) return;
    const currentUser = this.authService.currentUser();
    if (!currentUser) {
      this.statusUpdateError = 'Usuário não autenticado.';
      return;
    }

    this.isUpdatingStatus = true;
    this.statusUpdateError = '';
    this.statusUpdateSuccess = '';

    try {
      const agendamentoRef = doc(this.firestore, 'agendamentos', this.selectedAppointment.id);
      await updateDoc(agendamentoRef, { status: novoStatus });

      const updatedStatus = this.mapAgendamentoStatusToAppointmentStatus(novoStatus);
      this.selectedAppointment = {
        ...this.selectedAppointment,
        status: updatedStatus
      };

      this.allAgendamentos = this.allAgendamentos.map(agend =>
        agend.id === this.selectedAppointment?.id ? { ...agend, status: novoStatus } : agend
      );

      this.appointments = this.appointments.map(appt =>
        appt.id === this.selectedAppointment?.id ? { ...appt, status: updatedStatus } : appt
      );

      this.statusUpdateSuccess = 'Status atualizado com sucesso.';
    } catch (error) {
      console.error('Erro ao atualizar status do agendamento:', error);
      this.statusUpdateError = 'Não foi possível atualizar o status. Tente novamente.';
    } finally {
      this.isUpdatingStatus = false;
    }
  }

  canCancelAppointment(appt: Appointment | null): boolean {
    if (!appt) return false;
    if (this.isAppointmentInPast(appt)) return false;
    return appt.status === 'confirmed' || appt.status === 'pending';
  }

  async cancelarAgendamento(): Promise<void> {
    if (!this.selectedAppointment?.id || this.isCancellingAppointment) return;

    this.isCancellingAppointment = true;
    this.cancelAppointmentError = '';
    this.cancelAppointmentSuccess = '';

    try {
      const response = await fetch(`https://esteticazap-webhook.onrender.com/agenda/${this.selectedAppointment.id}/cancelar`, {
        method: 'POST',
        headers: { accept: 'application/json' },
        body: ''
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Falha ao cancelar agendamento.');
      }

      const agendamentoRef = doc(this.firestore, 'agendamentos', this.selectedAppointment.id);
      await updateDoc(agendamentoRef, { status: 'cancelado' });

      const updatedStatus = this.mapAgendamentoStatusToAppointmentStatus('cancelado');
      this.selectedAppointment = {
        ...this.selectedAppointment,
        status: updatedStatus
      };

      this.allAgendamentos = this.allAgendamentos.map(agend =>
        agend.id === this.selectedAppointment?.id ? { ...agend, status: 'cancelado' } : agend
      );

      this.appointments = this.appointments.map(appt =>
        appt.id === this.selectedAppointment?.id ? { ...appt, status: updatedStatus } : appt
      );

      this.cancelAppointmentSuccess = 'Agendamento cancelado e enviado para o cliente.';
    } catch (error) {
      console.error('Erro ao cancelar agendamento:', error);
      this.cancelAppointmentError = 'Não foi possível cancelar o agendamento. Tente novamente.';
    } finally {
      this.isCancellingAppointment = false;
    }
  }

  async enviarLembretesSelecionados(): Promise<void> {
    if (this.isSendingReminder) return;

    if (this.selectedReminderIds.size === 0) {
      this.reminderError = 'Selecione ao menos um atendimento.';
      this.reminderSuccess = '';
      return;
    }

    this.isSendingReminder = true;
    this.reminderError = '';
    this.reminderSuccess = '';

    try {
      const response = await fetch('http://localhost:3000/agenda/enviar-lembrete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agendamentosIds: Array.from(this.selectedReminderIds) })
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Falha ao enviar lembretes.');
      }

      this.reminderSuccess = 'Lembretes enviados com sucesso.';
      this.closeReminderModal();
    } catch (error) {
      console.error('Erro ao enviar lembretes:', error);
      this.reminderError = 'Não foi possível enviar os lembretes. Tente novamente.';
    } finally {
      this.isSendingReminder = false;
    }
  }
}
