import { Component, Inject, PLATFORM_ID, OnInit, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SideMenuComponent } from '../side-menu/side-menu.component';
import { SelectModule } from 'primeng/select';
import { Firestore, collection, query, where, getDocs } from '@angular/fire/firestore';
import { AuthService } from '../services/auth.service';
import { Profissional } from '../interfaces/profissional.interface';
import { ProfissionalService } from '../services/profissional.service';

interface ViewOption {
  label: string;
  value: string;
}

interface Agendamento {
  salonId: string;
  profissionalId?: string;      // Profissional responsável (pode ser undefined para agendamentos legado)
  profissionalNome?: string;    // Nome do profissional (denormalizado)
  clienteNome: string;
  clienteTelefone: string;
  servicos: { id: string; nome: string; valor: number; duracao: number }[];
  data: string;
  horaInicio: string;
  horaFim: string;
  status: 'pendente' | 'confirmado' | 'cancelado';
  valorTotal: number;
  duracaoTotal: number;
  createdAt: any;
}

interface Appointment {
  id: string;
  client: string;
  service: string;
  startTime: string;
  endTime: string;
  date: Date; // Data real do agendamento
  status: 'confirmed' | 'pending' | 'declined';
  image: string;
  price: string;
  profissionalId?: string;      // ID do profissional
  profissionalNome?: string;    // Nome do profissional
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
  imports: [CommonModule, SideMenuComponent, FormsModule, SelectModule],
  templateUrl: './agenda.component.html',
  styleUrls: ['./agenda.component.css']
})
export class AgendaComponent implements OnInit {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private profissionalService = inject(ProfissionalService);

  isBrowser: boolean;
  currentView = 'daily';
  isLoading = true;
  allAgendamentos: Agendamento[] = [];

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

      const snapshot = await getDocs(q);
      console.log(`Encontrados ${snapshot.docs.length} agendamentos no Firebase`);

      this.allAgendamentos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Agendamento & { id: string }));

      // Ordenar localmente por data
      this.allAgendamentos.sort((a, b) => {
        const dateA = new Date(a.data);
        const dateB = new Date(b.data);
        return dateA.getTime() - dateB.getTime();
      });

      console.log('Agendamentos ordenados:', this.allAgendamentos.length);

      // Converter para o formato Appointment
      this.appointments = this.allAgendamentos.map(agend => this.convertToAppointment(agend));

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
    let status: 'confirmed' | 'pending' | 'declined';
    if (agend.status === 'confirmado') {
      status = 'confirmed';
    } else if (agend.status === 'pendente') {
      status = 'pending';
    } else {
      status = 'declined';
    }

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
      profissionalNome: agend.profissionalNome
    };
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
    const day = this.currentDay.getDate();
    const month = this.monthNames[this.currentDay.getMonth()];
    const year = this.currentDay.getFullYear();
    return `${day} ${month} ${year}`;
  }

  get currentDayOfWeek(): string {
    return this.dayNames[this.currentDay.getDay()];
  }

  get dailySummary(): DailySummary {
    const dailyAppts = this.getDailyAppointments();
    const confirmed = dailyAppts.filter(a => a.status === 'confirmed').length;
    const pending = dailyAppts.filter(a => a.status === 'pending').length;
    const declined = dailyAppts.filter(a => a.status === 'declined').length;
    
    // Calcular faturamento (apenas confirmados e pendentes)
    const revenue = dailyAppts
      .filter(a => a.status === 'confirmed' || a.status === 'pending')
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
    const newDay = new Date(this.currentDay);
    newDay.setDate(newDay.getDate() - 1);
    this.currentDay = newDay;
  }

  nextDay(): void {
    const newDay = new Date(this.currentDay);
    newDay.setDate(newDay.getDate() + 1);
    this.currentDay = newDay;
  }

  getDailyAppointments(): Appointment[] {
    return this.appointments
      .filter(appt => appt.date.toDateString() === this.currentDay.toDateString())
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

  shouldShowLunchBreak(appt: Appointment, index: number): boolean {
    const dailyAppts = this.getDailyAppointments();
    const nextAppt = dailyAppts[index + 1];
    
    if (!nextAppt) return false;
    
    const currentEndHour = parseInt(appt.endTime.split(':')[0]);
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
    
    const monthlyAppts = this.appointments.filter(appt => {
      return appt.date.getFullYear() === year && appt.date.getMonth() === month;
    });

    const confirmed = monthlyAppts.filter(a => a.status === 'confirmed').length;
    const pending = monthlyAppts.filter(a => a.status === 'pending').length;
    const declined = monthlyAppts.filter(a => a.status === 'declined').length;
    
    // Calcular faturamento (apenas confirmados e pendentes)
    const revenue = monthlyAppts
      .filter(a => a.status === 'confirmed' || a.status === 'pending')
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
    return appointments.filter(a => a.status === 'confirmed').length;
  }

  getPendingCount(appointments: Appointment[]): number {
    return appointments.filter(a => a.status === 'pending').length;
  }

  // ==================== UTILITÁRIOS ====================

  getStatusClass(status: string): string {
    switch (status) {
      case 'confirmed': return 'status-confirmed';
      case 'pending': return 'status-pending';
      case 'declined': return 'status-declined';
      default: return '';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'confirmed': return 'Confirmado';
      case 'pending': return 'Pendente';
      case 'declined': return 'Recusado';
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
   * Obter cor única por profissional
   */
  getProfissionalColor(profissionalId?: string): string {
    if (!profissionalId) return '#9E9E9E'; // Cinza para agendamentos sem profissional

    const index = this.profissionais.findIndex(p => p.id === profissionalId);
    if (index === -1) return '#9E9E9E';

    const colors = ['#e91e63', '#ff6f9d', '#f48fb1', '#ba68c8', '#9c27b0', '#ff8fb8', '#f06292', '#ad1457'];
    return colors[index % colors.length];
  }
}
