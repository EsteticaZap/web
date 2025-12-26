import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from '@angular/fire/firestore';
import { Servico } from '../onboarding/onboarding.component';
import { ClienteService } from '../services/cliente.service';
import { Profissional } from '../interfaces/profissional.interface';
import { ProfissionalService } from '../services/profissional.service';

interface HorarioTrabalho {
  inicio: string;
  fim: string;
  ativo: boolean;
  temIntervalo: boolean;
  intervaloInicio: string;
  intervaloFim: string;
}

interface SalaoData {
  uid: string;
  displayName: string;
  email: string;
  fotoSalao?: string;
  configuracoes?: {
    nomeSalao: string;
    telefone: string;
    whatsapp: string;
    descricao: string;
    endereco: string;
    cidade: string;
    estado: string;
    cep: string;
    horariosFuncionamento: {
      domingo: HorarioTrabalho;
      segunda: HorarioTrabalho;
      terca: HorarioTrabalho;
      quarta: HorarioTrabalho;
      quinta: HorarioTrabalho;
      sexta: HorarioTrabalho;
      sabado: HorarioTrabalho;
    };
    intervaloAgendamento: number;
    antecedenciaMinima: number;
    antecedenciaMaxima: number;
  };
}

interface Agendamento {
  salonId: string;
  profissionalId: string;     // NOVO: ID do profissional
  profissionalNome: string;   // NOVO: Nome do profissional (denormalizado)
  clienteId: string;          // ID do cliente vinculado
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

@Component({
  selector: 'app-agendar-publico',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './agendar-publico.component.html',
  styleUrls: ['./agendar-publico.component.css']
})
export class AgendarPublicoComponent implements OnInit {
  private firestore = inject(Firestore);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private clienteService = inject(ClienteService);
  private profissionalService = inject(ProfissionalService);

  salonId: string = '';
  salao: SalaoData | null = null;
  servicos: Servico[] = [];
  profissionais: Profissional[] = [];
  isLoading = true;
  errorMessage = '';

  // Etapas do wizard
  currentStep = 1;
  totalSteps = 4;

  // Etapa 1: Profissional selecionado
  profissionalSelecionado: Profissional | null = null;

  // Etapa 2: Serviços selecionados
  servicosSelecionados: Servico[] = [];

  // Etapa 3: Data e horário selecionados
  dataSelecionada: Date | null = null;
  diasDisponiveis: Date[] = [];
  horarioSelecionado: string = '';
  horariosDisponiveis: string[] = [];

  // Etapa 4: Dados do cliente
  clienteNome = '';
  clienteTelefone = '';

  // Calendário
  currentMonth: Date = new Date();
  calendarDays: { date: Date; day: number; isCurrentMonth: boolean; isDisabled: boolean; isSelected: boolean }[] = [];
  monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  weekDayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  isSaving = false;
  successMessage = '';

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.salonId = params['salonId'];
      if (this.salonId) {
        this.carregarDadosSalao();
      } else {
        this.errorMessage = 'ID do salão não fornecido.';
        this.isLoading = false;
      }
    });
  }

  async carregarDadosSalao(): Promise<void> {
    try {
      // Buscar dados do salão
      const salonDocRef = doc(this.firestore, 'users', this.salonId);
      const salonSnap = await getDoc(salonDocRef);

      if (!salonSnap.exists()) {
        this.errorMessage = 'Salão não encontrado.';
        this.isLoading = false;
        return;
      }

      this.salao = salonSnap.data() as SalaoData;

      // Buscar serviços ativos do salão
      const servicosRef = collection(this.firestore, 'servicos');
      const q = query(servicosRef, where('userId', '==', this.salonId), where('ativo', '==', true));
      const snapshot = await getDocs(q);

      this.servicos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Servico));

      // Buscar profissionais ativos do salão
      this.profissionais = await this.profissionalService.listarAtivos(this.salonId);

      if (this.profissionais.length === 0) {
        this.errorMessage = 'Este salão ainda não cadastrou profissionais. Entre em contato diretamente.';
        this.isLoading = false;
        return;
      }

      // Se houver apenas 1 profissional, selecionar automaticamente
      if (this.profissionais.length === 1) {
        this.profissionalSelecionado = this.profissionais[0];
        console.log('Profissional único selecionado automaticamente:', this.profissionalSelecionado.nome);
      }

      this.generateCalendar();
      this.isLoading = false;
    } catch (error) {
      console.error('Erro ao carregar dados do salão:', error);
      this.errorMessage = 'Erro ao carregar informações do salão.';
      this.isLoading = false;
    }
  }

  // ==================== ETAPA 1: SERVIÇOS ====================

  toggleServico(servico: Servico): void {
    const index = this.servicosSelecionados.findIndex(s => s.id === servico.id);
    if (index > -1) {
      this.servicosSelecionados.splice(index, 1);
    } else {
      this.servicosSelecionados.push(servico);
    }
  }

  isServicoSelecionado(servico: Servico): boolean {
    return this.servicosSelecionados.some(s => s.id === servico.id);
  }

  get valorTotal(): number {
    return this.servicosSelecionados.reduce((sum, s) => sum + s.valor, 0);
  }

  get duracaoTotal(): number {
    return this.servicosSelecionados.reduce((sum, s) => {
      let duracao = typeof s.duracao === 'string' ? parseInt(s.duracao, 10) : s.duracao;

      if (isNaN(duracao)) {
        duracao = 0;
      }

      if (duracao >= 100 && duracao < 1000) {
        const horas = Math.floor(duracao / 100);
        const minutos = duracao % 100;
        duracao = (horas * 60) + minutos;
      }

      return sum + duracao;
    }, 0);
  }

  formatarValor(valor: number): string {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatarDuracao(minutos: number): string {
    if (minutos < 60) return `${minutos} min`;
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    return mins === 0 ? `${horas}h` : `${horas}h ${mins}min`;
  }

  // ==================== ETAPA 2: DATA ====================

  generateCalendar(): void {
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startingDay = firstDay.getDay();
    const prevMonth = new Date(year, month, 0);
    const prevMonthDays = prevMonth.getDate();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    this.calendarDays = [];

    // Dias do mês anterior
    for (let i = startingDay - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthDays - i);
      this.calendarDays.push({ 
        date, 
        day: prevMonthDays - i, 
        isCurrentMonth: false, 
        isDisabled: true,
        isSelected: false
      });
    }

    // Dias do mês atual
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      const isDisabled = !this.isDiaDisponivel(date);
      const isSelected = this.dataSelecionada?.toDateString() === date.toDateString();
      this.calendarDays.push({ date, day: i, isCurrentMonth: true, isDisabled, isSelected });
    }

    // Dias do próximo mês
    const remainingDays = 42 - this.calendarDays.length;
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(year, month + 1, i);
      this.calendarDays.push({ 
        date, 
        day: i, 
        isCurrentMonth: false, 
        isDisabled: true,
        isSelected: false
      });
    }
  }

  isDiaDisponivel(date: Date): boolean {
    if (!this.salao?.configuracoes) return false;

    // Verificar antecedência mínima
    const now = new Date();
    const minDate = new Date(now.getTime() + (this.salao.configuracoes.antecedenciaMinima * 60 * 60 * 1000));
    if (date < minDate) return false;

    // Verificar antecedência máxima
    const maxDate = new Date(now.getTime() + (this.salao.configuracoes.antecedenciaMaxima * 24 * 60 * 60 * 1000));
    if (date > maxDate) return false;

    // Verificar se o dia está ativo
    const dayOfWeek = date.getDay();
    const dias = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const diaKey = dias[dayOfWeek] as keyof typeof this.salao.configuracoes.horariosFuncionamento;
    return this.salao.configuracoes.horariosFuncionamento[diaKey].ativo;
  }

  selecionarData(day: { date: Date; isDisabled: boolean }): void {
    if (day.isDisabled) return;
    this.dataSelecionada = day.date;
    this.generateCalendar();
    this.calcularHorariosDisponiveis();
  }

  previousMonth(): void {
    this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() - 1, 1);
    this.generateCalendar();
  }

  nextMonth(): void {
    this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 1);
    this.generateCalendar();
  }

  get currentMonthFormatted(): string {
    return `${this.monthNames[this.currentMonth.getMonth()]} ${this.currentMonth.getFullYear()}`;
  }

  // ==================== ETAPA 3: HORÁRIO ====================

  async calcularHorariosDisponiveis(): Promise<void> {
    if (!this.dataSelecionada || !this.salao?.configuracoes) return;

    this.horariosDisponiveis = [];
    const dayOfWeek = this.dataSelecionada.getDay();
    const dias = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const diaKey = dias[dayOfWeek] as keyof typeof this.salao.configuracoes.horariosFuncionamento;
    const horario = this.salao.configuracoes.horariosFuncionamento[diaKey];

    if (!horario.ativo) return;

    // Buscar agendamentos existentes para o dia (apenas do profissional selecionado)
    const agendamentosRef = collection(this.firestore, 'agendamentos');
    const dataStr = this.dataSelecionada.toISOString().split('T')[0];
    const q = query(
      agendamentosRef,
      where('profissionalId', '==', this.profissionalSelecionado!.id),  // 🔥 MUDANÇA CRÍTICA: filtro por profissional
      where('data', '==', dataStr),
      where('status', 'in', ['pendente', 'confirmado'])
    );
    const snapshot = await getDocs(q);
    const agendamentosExistentes = snapshot.docs.map(doc => doc.data() as Agendamento);

    // Gerar slots de horário
    const slots: string[] = [];
    const [horaInicio, minInicio] = horario.inicio.split(':').map(Number);
    const [horaFim, minFim] = horario.fim.split(':').map(Number);
    const intervaloMinutos = this.salao.configuracoes.intervaloAgendamento;

    let currentTime = horaInicio * 60 + minInicio;
    const endTime = horaFim * 60 + minFim;

    while (currentTime + this.duracaoTotal <= endTime) {
      const horas = Math.floor(currentTime / 60);
      const minutos = currentTime % 60;
      const timeStr = `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;

      // Verificar se o horário está no intervalo de almoço
      if (horario.temIntervalo) {
        const [intervaloIniHora, intervaloIniMin] = horario.intervaloInicio.split(':').map(Number);
        const [intervaloFimHora, intervaloFimMin] = horario.intervaloFim.split(':').map(Number);
        const intervaloIni = intervaloIniHora * 60 + intervaloIniMin;
        const intervaloFim = intervaloFimHora * 60 + intervaloFimMin;

        // Se o agendamento cair no intervalo ou atravessar ele, pular
        if (currentTime < intervaloFim && (currentTime + this.duracaoTotal) > intervaloIni) {
          currentTime = intervaloFim;
          continue;
        }
      }

      // Verificar conflito com agendamentos existentes
      const temConflito = agendamentosExistentes.some(agend => {
        const [agendIniHora, agendIniMin] = agend.horaInicio.split(':').map(Number);
        const [agendFimHora, agendFimMin] = agend.horaFim.split(':').map(Number);
        const agendIni = agendIniHora * 60 + agendIniMin;
        const agendFim = agendFimHora * 60 + agendFimMin;

       return currentTime < agendFim && (currentTime + this.duracaoTotal) > agendIni;
      });

      if (!temConflito) {
        slots.push(timeStr);
      }

      currentTime += intervaloMinutos;
    }

    this.horariosDisponiveis = slots;
  }

  selecionarHorario(horario: string): void {
    this.horarioSelecionado = horario;
  }

  // ==================== NAVEGAÇÃO ====================

  selecionarProfissional(profissional: Profissional): void {
    this.profissionalSelecionado = profissional;
  }

  canGoNext(): boolean {
    switch (this.currentStep) {
      case 1: return this.profissionalSelecionado !== null;
      case 2: return this.servicosSelecionados.length > 0;
      case 3: return this.dataSelecionada !== null && this.horarioSelecionado !== '';
      case 4: return this.clienteNome.trim() !== '' && this.clienteTelefone.trim() !== '';
      default: return false;
    }
  }

  nextStep(): void {
    if (!this.canGoNext()) return;
    
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
    }
  }

  prevStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  formatPhone(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');
    
    if (value.length <= 10) {
      value = value.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    } else {
      value = value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    
    this.clienteTelefone = value;
  }

  // ==================== FINALIZAR ====================

  async finalizarAgendamento(): Promise<void> {
    if (!this.canGoNext() || !this.dataSelecionada || !this.salao) return;

    this.isSaving = true;
    this.errorMessage = '';

    try {
      // ETAPA 1: Verificar se cliente já existe pelo telefone
      console.log('Verificando se cliente existe com telefone:', this.clienteTelefone);
      let clienteId: string;
      let clienteExistente = await this.clienteService.buscarClientePorTelefone(
        this.salonId, 
        this.clienteTelefone
      );

      if (clienteExistente && clienteExistente.id) {
        // Cliente já existe - usar o ID existente
        clienteId = clienteExistente.id;
        console.log('Cliente já existe. ID:', clienteId);
      } else {
        // Cliente não existe - criar novo cliente
        console.log('Cliente não encontrado. Criando novo cliente...');
        clienteId = await this.clienteService.criarCliente({
          salonId: this.salonId,
          nome: this.clienteNome,
          telefone: this.clienteTelefone,
          dataCadastro: new Date(),
          ultimaVisita: null,
          totalVisitas: 0,
          totalGasto: 0,
          servicosRealizados: [],
          datasAgendamentos: [],
          status: 'ativo'
        });
        console.log('Novo cliente criado com ID:', clienteId);
      }

      // ETAPA 2: Calcular horário de fim
      const [hora, min] = this.horarioSelecionado.split(':').map(Number);
      const totalMinutos = hora * 60 + min + this.duracaoTotal;
      const horaFim = Math.floor(totalMinutos / 60);
      const minFim = totalMinutos % 60;
      const horaFimStr = `${String(horaFim).padStart(2, '0')}:${String(minFim).padStart(2, '0')}`;

      const dataAgendamento = this.dataSelecionada.toISOString().split('T')[0];

      // ETAPA 3: Criar agendamento vinculado ao cliente e profissional
      const agendamento: Agendamento = {
        salonId: this.salonId,
        profissionalId: this.profissionalSelecionado!.id!,      // Vincular ao profissional
        profissionalNome: this.profissionalSelecionado!.nome,   // Denormalizado para performance
        clienteId: clienteId,  // Vincular ao cliente
        clienteNome: this.clienteNome,
        clienteTelefone: this.clienteTelefone,
        servicos: this.servicosSelecionados.map(s => ({
          id: s.id!,
          nome: s.nome,
          valor: s.valor,
          duracao: s.duracao
        })),
        data: dataAgendamento,
        horaInicio: this.horarioSelecionado,
        horaFim: horaFimStr,
        status: 'pendente',
        valorTotal: this.valorTotal,
        duracaoTotal: this.duracaoTotal,
        createdAt: serverTimestamp()
      };

      const agendamentosRef = collection(this.firestore, 'agendamentos');
      await addDoc(agendamentosRef, agendamento);
      console.log('Agendamento criado com sucesso');

      // ETAPA 4: Registrar agendamento no histórico do cliente
      await this.clienteService.registrarAgendamento(
        clienteId,
        this.servicosSelecionados.map(s => ({
          id: s.id!,
          nome: s.nome,
          valor: s.valor
        })),
        dataAgendamento,
        this.valorTotal
      );
      console.log('Histórico do cliente atualizado');

      this.successMessage = 'Agendamento realizado com sucesso! Em breve você receberá uma confirmação.';
      this.currentStep = 5; // Tela de sucesso
    } catch (error) {
      console.error('Erro ao criar agendamento:', error);
      this.errorMessage = 'Erro ao realizar agendamento. Tente novamente.';
    } finally {
      this.isSaving = false;
    }
  }

  novoAgendamento(): void {
    this.currentStep = 1;
    this.servicosSelecionados = [];
    this.dataSelecionada = null;
    this.horarioSelecionado = '';
    this.clienteNome = '';
    this.clienteTelefone = '';
    this.successMessage = '';
    this.generateCalendar();
  }
}
