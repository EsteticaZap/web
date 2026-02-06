import { Component, AfterViewInit, ViewChild, ElementRef, Inject, PLATFORM_ID, OnInit, inject, effect } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { ClienteService } from '../services/cliente.service';
import { Firestore, collection, query, where, getDocs, orderBy } from '@angular/fire/firestore';
import { Chart, registerables } from 'chart.js';
import { SelectModule } from 'primeng/select';
import { DrawerModule } from 'primeng/drawer';
import { DatePickerModule } from 'primeng/datepicker';

Chart.register(...registerables);

interface Agendamento {
  id?: string;
  salonId: string;
  clienteId: string;
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
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    SelectModule,
    DrawerModule,
    DatePickerModule
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit, AfterViewInit {
  @ViewChild('barCanvas', { static: false }) barCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('servicesCanvas', { static: false }) servicesCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('paymentsCanvas', { static: false }) paymentsCanvas!: ElementRef<HTMLCanvasElement>;

  private isBrowser: boolean;
  private authService = inject(AuthService);
  private firestore = inject(Firestore);
  private clienteService = inject(ClienteService);
  private dataLoaded = false;

  isLoadingData = true;

  userName = 'Usuário';
  nextAppointment: {
    client: string;
    time: string;
    service: string;
    remaining: string;
  } | null = null;
  
  stats = {
    today: 0,
    weekRevenue: 0,
    activeClients: 0
  };
  
  appointments: Array<{
    time: string;
    name: string;
    service: string;
    status: string;
    image: string;
  }> = [];

  // Dados para gráficos
  weeklyRevenue: number[] = [0, 0, 0, 0, 0, 0, 0];
  topServices: { label: string; count: number }[] = [];
  attendanceStats = { showed: 0, noShow: 0 };
  chartLabels: string[] = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  periodOptions = [
    { label: 'Diário', value: 'daily' },
    { label: 'Semanal', value: 'weekly' },
    { label: 'Mensal', value: 'monthly' },
    { label: 'Customizado', value: 'custom' }
  ];
  selectedPeriod = 'weekly';
  previousPeriod = 'weekly';
  isCustomDrawerOpen = false;
  customStartDate: Date | null = null;
  customEndDate: Date | null = null;
  customDateError = '';
  private isCustomPeriodApplied = false;
  private barChart: Chart | null = null;
  private servicesChart: Chart | null = null;
  private attendanceChart: Chart | null = null;
  isDownloadingExcel = false;
  isDownloadingPdf = false;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    
    // Usar effect para reagir às mudanças no userData
    effect(() => {
      const userData = this.authService.userData();
      if (userData) {
        this.userName = userData.displayName || userData.configuracoes?.nomeSalao || this.userName;

        if (!userData.onboardingCompleted) {
          this.dataLoaded = false;
          this.isLoadingData = false;
          return;
        }

        if (this.isBrowser && !this.dataLoaded) {
          this.dataLoaded = true;
          this.carregarDados();
        }
      } else {
        this.dataLoaded = false;
        this.isLoadingData = false;
      }
    });
  }

  async ngOnInit(): Promise<void> {
  }

  async downloadExcelReport(): Promise<void> {
    if (!this.isBrowser || this.isDownloadingExcel) {
      return;
    }

    const currentUser = this.authService.currentUser();
    if (!currentUser) {
      console.error('Usuário não autenticado');
      return;
    }

    try {
      this.isDownloadingExcel = true;
      const response = await fetch(
        `https://esteticazap-webhook.onrender.com/saloes/${currentUser.uid}/relatorio-excel`,
        {
          headers: {
            accept: 'application/vnd.ms-excel'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Falha ao gerar o relatório em Excel.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().split('T')[0];
      link.href = url;
      link.download = `relatorio-${timestamp}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao baixar Excel:', error);
    } finally {
      this.isDownloadingExcel = false;
    }
  }

  async downloadPdfReport(): Promise<void> {
    if (!this.isBrowser || this.isDownloadingPdf) {
      return;
    }

    const currentUser = this.authService.currentUser();
    if (!currentUser) {
      console.error('Usuário não autenticado');
      return;
    }

    try {
      this.isDownloadingPdf = true;
      const response = await fetch(
        `/api/relatorio/${currentUser.uid}`,
        {
          headers: {
            accept: 'application/pdf'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Falha ao gerar o relatório em PDF.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().split('T')[0];
      link.href = url;
      link.download = `relatorio-${timestamp}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao baixar PDF:', error);
    } finally {
      this.isDownloadingPdf = false;
    }
  }

  /**
   * Carregar todos os dados do Firebase
   */
  async carregarDados(): Promise<void> {
    try {
      this.isLoadingData = true;
      const currentUser = this.authService.currentUser();
      
      if (!currentUser) {
        console.error('Usuário não autenticado');
        this.isLoadingData = false;
        return;
      }

      // Carregar dados em paralelo
      await Promise.all([
        this.carregarAgendamentosHoje(currentUser.uid),
        this.carregarEstatisticas(currentUser.uid),
        this.carregarFaturamentoPeriodo(currentUser.uid),
        this.carregarServicosPopulares(currentUser.uid),
        this.carregarTaxaComparecimento(currentUser.uid)
      ]);

      this.isLoadingData = false;
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      this.isLoadingData = false;
    }
  }

  /**
   * Carregar agendamentos de hoje
   */
  async carregarAgendamentosHoje(salonId: string): Promise<void> {
    try {
      const hoje = new Date();
      const dataHoje = hoje.toISOString().split('T')[0];
      
      const agendamentosRef = collection(this.firestore, 'agendamentos');
      const q = query(
        agendamentosRef,
        where('salonId', '==', salonId),
        where('data', '==', dataHoje),
        where('status', 'in', ['pendente', 'confirmado'])
      );
      
      const snapshot = await getDocs(q);
      const agendamentosHoje: Agendamento[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Agendamento));

      // Ordenar por hora
      agendamentosHoje.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));

      // Converter para formato da UI
      this.appointments = agendamentosHoje.map(agend => {
        const servicosNomes = agend.servicos.map(s => s.nome).join(', ');
        let status = 'Pendente';
        if (agend.status === 'confirmado') status = 'Confirmado';
        
        return {
          time: agend.horaInicio,
          name: agend.clienteNome,
          service: servicosNomes,
          status: status,
          image: '/girllandpage.png'
        };
      });

      // Encontrar próximo agendamento
      const horaAtual = hoje.toTimeString().split(' ')[0].substring(0, 5);
      const proximoAgend = agendamentosHoje.find(a => a.horaInicio > horaAtual);
      
      if (proximoAgend) {
        const servicosNomes = proximoAgend.servicos.map(s => s.nome).join(', ');
        this.nextAppointment = {
          client: proximoAgend.clienteNome,
          time: proximoAgend.horaInicio,
          service: servicosNomes,
          remaining: this.calcularTempoRestante(proximoAgend.horaInicio)
        };
      } else {
        this.nextAppointment = null;
      }

    } catch (error) {
      console.error('Erro ao carregar agendamentos de hoje:', error);
    }
  }

  /**
   * Calcular tempo restante até o agendamento
   */
  private calcularTempoRestante(horaInicio: string): string {
    const agora = new Date();
    const [hora, minuto] = horaInicio.split(':').map(Number);
    const agendamento = new Date(agora);
    agendamento.setHours(hora, minuto, 0, 0);
    
    const diff = agendamento.getTime() - agora.getTime();
    const minutos = Math.floor(diff / 60000);
    
    if (minutos < 0) return 'Em andamento';
    if (minutos < 60) return `${minutos}min`;
    
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    return mins > 0 ? `${horas}h ${mins}min` : `${horas}h`;
  }

  /**
   * Carregar estatísticas
   */
  async carregarEstatisticas(salonId: string): Promise<void> {
    try {
      const hoje = new Date();
      const dataHoje = hoje.toISOString().split('T')[0];
      
      // Agendamentos de hoje
      const agendamentosHojeRef = collection(this.firestore, 'agendamentos');
      const qHoje = query(
        agendamentosHojeRef,
        where('salonId', '==', salonId),
        where('data', '==', dataHoje)
      );
      const snapshotHoje = await getDocs(qHoje);
      this.stats.today = snapshotHoje.size;

      // Clientes ativos
      const clientesAtivos = await this.clienteService.listarClientesPorSalao(salonId);
      this.stats.activeClients = clientesAtivos.filter(c => c.status === 'ativo').length;

    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  }

  /**
   * Carregar faturamento por período
   */
  async carregarFaturamentoPeriodo(salonId: string): Promise<void> {
    try {
      const dateRange = this.getDateRange();
      const totalsByDate = new Map<string, number>();
      let totalPeriodo = 0;

      const agendamentosRef = collection(this.firestore, 'agendamentos');
      const q = query(
        agendamentosRef,
        where('salonId', '==', salonId),
        where('data', '>=', dateRange.start),
        where('data', '<=', dateRange.end),
        where('status', 'in', ['confirmado', 'pendente'])
      );

      const snapshot = await getDocs(q);
      snapshot.docs.forEach(doc => {
        const agend = doc.data() as Agendamento;
        const data = agend.data;
        const valor = agend.valorTotal || 0;
        totalsByDate.set(data, (totalsByDate.get(data) || 0) + valor);
        totalPeriodo += valor;
      });

      this.chartLabels = dateRange.labels;
      this.weeklyRevenue = dateRange.dates.map(data => totalsByDate.get(data) || 0);
      this.stats.weekRevenue = totalPeriodo;
      this.updateBarChart();

    } catch (error) {
      console.error('Erro ao carregar faturamento por período:', error);
    }
  }

  /**
   * Carregar taxa de comparecimento (compareceu vs cancelou/no-show)
   */
  async carregarTaxaComparecimento(salonId: string): Promise<void> {
    try {
      let showed = 0;
      let noShow = 0;
      const dateRange = this.getDateRange();
      const agendamentosRef = collection(this.firestore, 'agendamentos');
      const q = query(
        agendamentosRef,
        where('salonId', '==', salonId),
        where('data', '>=', dateRange.start),
        where('data', '<=', dateRange.end),
        where('status', 'in', ['confirmado', 'cancelado'])
      );

      const snapshot = await getDocs(q);
      snapshot.docs.forEach(doc => {
        const agend = doc.data() as Agendamento;
        if (agend.status === 'confirmado') {
          showed += 1;
        } else if (agend.status === 'cancelado') {
          noShow += 1;
        }
      });

      this.attendanceStats = { showed, noShow };
      this.updateAttendanceChart();
    } catch (error) {
      console.error('Erro ao carregar taxa de comparecimento:', error);
    }
  }

  /**
   * Carregar serviços mais populares
   */
  async carregarServicosPopulares(salonId: string): Promise<void> {
    try {
      const dateRange = this.getDateRange();
      const agendamentosRef = collection(this.firestore, 'agendamentos');
      const q = query(
        agendamentosRef,
        where('salonId', '==', salonId),
        where('data', '>=', dateRange.start),
        where('data', '<=', dateRange.end),
        where('status', 'in', ['confirmado', 'pendente'])
      );
      
      const snapshot = await getDocs(q);
      const servicosCount = new Map<string, number>();
      
      snapshot.docs.forEach(doc => {
        const agend = doc.data() as Agendamento;
        agend.servicos?.forEach(servico => {
          const count = servicosCount.get(servico.nome) || 0;
          servicosCount.set(servico.nome, count + 1);
        });
      });

      // Ordenar e pegar top 5
      this.topServices = Array.from(servicosCount.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      this.updateServicesChart();

    } catch (error) {
      console.error('Erro ao carregar serviços populares:', error);
    }
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;

    // Delay para garantir que o DOM e dados estejam prontos
    setTimeout(() => {
      this.initCharts();
    }, 500);
  }

  private initCharts(): void {
    // Faturamento semanal com dados reais
    if (this.barCanvas?.nativeElement) {
      const ctx = this.barCanvas.nativeElement.getContext('2d');
      if (ctx) {
        this.barChart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: this.chartLabels,
            datasets: [
              {
                label: 'Faturamento (R$)',
                data: this.weeklyRevenue,
                backgroundColor: '#e91e63'
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: { beginAtZero: true }
            },
            plugins: {
              tooltip: {
                callbacks: {
                  label: (context) => {
                    const value = context.parsed.y || 0;
                    return `R$ ${value.toFixed(2)}`;
                  }
                }
              }
            }
          }
        });
      }
    }

    // Serviços Mais Realizados com dados reais
    if (this.servicesCanvas?.nativeElement) {
      const servicesCtx = this.servicesCanvas.nativeElement.getContext('2d');
      if (servicesCtx) {
        const { labels, data, colors } = this.getServicesChartData();

        this.servicesChart = new Chart(servicesCtx, {
          type: 'bar',
          data: {
            labels,
            datasets: [
              {
                label: 'Quantidade',
                data,
                backgroundColor: colors
              }
            ]
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: { beginAtZero: true }
            }
          }
        });
      }
    }

    // Taxa de comparecimento (compareceu vs cancelou/no-show)
    if (this.paymentsCanvas?.nativeElement) {
      const paymentsCtx = this.paymentsCanvas.nativeElement.getContext('2d');
      if (paymentsCtx) {
        const { data } = this.getAttendanceChartData();

        this.attendanceChart = new Chart(paymentsCtx, {
          type: 'bar',
          data: {
            labels: ['Compareceu', 'Cancelou/No-show'],
            datasets: [
              {
                label: 'Atendimentos',
                data,
                backgroundColor: ['#e91e63', '#ff6b6b']
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: false
              },
              tooltip: {
                callbacks: {
                  label: (context) => {
                    const value = context.parsed.y || 0;
                    return `${context.label}: ${value}`;
                  }
                }
              }
            },
            scales: {
              y: { beginAtZero: true, ticks: { precision: 0 } }
            }
          }
        });
      }
    }
  }

  onPeriodChange(period: string): void {
    this.previousPeriod = this.selectedPeriod;
    this.selectedPeriod = period;
    if (period === 'custom') {
      this.isCustomPeriodApplied = false;
      this.customDateError = '';
      this.isCustomDrawerOpen = true;
      return;
    }

    this.applyPeriodFilters();
  }

  handleCustomDrawerHide(): void {
    if (!this.isCustomPeriodApplied) {
      this.selectedPeriod = this.previousPeriod;
    }
    this.customDateError = '';
  }

  applyCustomPeriod(): void {
    if (!this.customStartDate || !this.customEndDate) {
      this.customDateError = 'Informe a data de início e a data de fim.';
      return;
    }

    if (this.customStartDate.getTime() > this.customEndDate.getTime()) {
      this.customDateError = 'A data de início deve ser menor ou igual à data de fim.';
      return;
    }

    this.customDateError = '';
    this.selectedPeriod = 'custom';
    this.isCustomPeriodApplied = true;
    this.isCustomDrawerOpen = false;
    this.applyPeriodFilters();
  }

  private applyPeriodFilters(): void {
    const currentUser = this.authService.currentUser();
    if (!currentUser) return;

    this.carregarFaturamentoPeriodo(currentUser.uid);
    this.carregarServicosPopulares(currentUser.uid);
    this.carregarTaxaComparecimento(currentUser.uid);
  }

  private updateBarChart(): void {
    if (!this.barChart) return;

    this.barChart.data.labels = this.chartLabels;
    this.barChart.data.datasets[0].data = this.weeklyRevenue;
    this.barChart.update();
  }

  private updateServicesChart(): void {
    if (!this.servicesChart) return;

    const { labels, data, colors } = this.getServicesChartData();
    this.servicesChart.data.labels = labels;
    this.servicesChart.data.datasets[0].data = data;
    (this.servicesChart.data.datasets[0].backgroundColor as string[]) = colors;
    this.servicesChart.update();
  }

  private getServicesChartData(): { labels: string[]; data: number[]; colors: string[] } {
    const labels = this.topServices.map(service => service.label);
    const data = this.topServices.map(service => service.count);
    const colors = ['#e91e63', '#ff6b6b', '#e91e63', '#ff6b6b', '#e91e63'];

    return {
      labels: labels.length > 0 ? labels : ['Sem dados'],
      data: data.length > 0 ? data : [0],
      colors
    };
  }

  private updateAttendanceChart(): void {
    if (!this.attendanceChart) return;

    const { data } = this.getAttendanceChartData();
    this.attendanceChart.data.datasets[0].data = data;
    this.attendanceChart.update();
  }

  private getAttendanceChartData(): { data: number[] } {
    const showed = this.attendanceStats.showed;
    const noShow = this.attendanceStats.noShow;
    const hasData = showed > 0 || noShow > 0;

    return {
      data: hasData ? [showed, noShow] : [0, 0]
    };
  }

  private getDateRange(): { start: string; end: string; dates: string[]; labels: string[] } {
    const hoje = new Date();
    let startDate: Date;
    let endDate: Date;

    if (this.selectedPeriod === 'daily') {
      startDate = new Date(hoje);
      endDate = new Date(hoje);
    } else if (this.selectedPeriod === 'monthly') {
      endDate = new Date(hoje);
      startDate = new Date(hoje);
      startDate.setDate(startDate.getDate() - 29);
    } else if (this.selectedPeriod === 'custom' && this.customStartDate && this.customEndDate) {
      startDate = new Date(this.customStartDate);
      endDate = new Date(this.customEndDate);
    } else {
      endDate = new Date(hoje);
      startDate = new Date(hoje);
      startDate.setDate(startDate.getDate() - 6);
    }

    const dates: string[] = [];
    const labels: string[] = [];
    const cursor = new Date(startDate);

    while (cursor <= endDate) {
      const dateIso = this.formatDateForQuery(cursor);
      dates.push(dateIso);
      labels.push(cursor.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
      cursor.setDate(cursor.getDate() + 1);
    }

    return {
      start: dates[0],
      end: dates[dates.length - 1],
      dates,
      labels
    };
  }

  private formatDateForQuery(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
