import { Component, AfterViewInit, ViewChild, ElementRef, Inject, PLATFORM_ID, OnInit, inject, effect } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SideMenuComponent } from '../side-menu/side-menu.component';
import { OnboardingComponent } from '../onboarding/onboarding.component';
import { AuthService } from '../services/auth.service';
import { ClienteService } from '../services/cliente.service';
import { Firestore, doc, getDoc, collection, query, where, getDocs, orderBy } from '@angular/fire/firestore';
import { Chart, registerables } from 'chart.js';
import { SelectModule } from 'primeng/select';

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
    SideMenuComponent,
    OnboardingComponent,
    SelectModule
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

  // Modal de onboarding
  showOnboarding = false;
  onboardingChecked = false;
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
  periodOptions = [{ label: 'Esta Semana', value: 'thisWeek' }];
  selectedPeriod = this.periodOptions[0].value;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    
    // Usar effect para reagir às mudanças no userData
    effect(() => {
      const userData = this.authService.userData();
      if (userData && !this.onboardingChecked) {
        this.checkOnboardingStatus(userData);
      }
    });
  }

  async ngOnInit(): Promise<void> {
    // Verificar onboarding quando o componente inicializa
    await this.checkOnboarding();
    
    // Carregar dados do Firebase
    if (this.isBrowser) {
      await this.carregarDados();
    }
  }

  private async checkOnboarding(): Promise<void> {
    if (!this.isBrowser) return;

    const currentUser = this.authService.currentUser();
    if (!currentUser) return;

    try {
      const userDocRef = doc(this.firestore, 'users', currentUser.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        this.checkOnboardingStatus(userData);
        
        // Atualizar nome do usuário
        if (userData['displayName']) {
          this.userName = userData['displayName'];
        }
      } else {
        // Documento não existe, mostrar onboarding
        this.showOnboarding = true;
      }
    } catch (error) {
      console.error('Erro ao verificar onboarding:', error);
    }
    
    this.onboardingChecked = true;
  }

  private checkOnboardingStatus(userData: any): void {
    if (!userData['onboardingCompleted']) {
      this.showOnboarding = true;
    } else {
      this.showOnboarding = false;
      // Atualizar nome do usuário
      if (userData['displayName']) {
        this.userName = userData['displayName'];
      } else if (userData['configuracoes']?.nomeSalao) {
        this.userName = userData['configuracoes'].nomeSalao;
      }
    }
    this.onboardingChecked = true;
  }

  onOnboardingComplete(): void {
    this.showOnboarding = false;
    // Recarregar dados do usuário
    this.checkOnboarding();
    // Carregar dados após onboarding
    this.carregarDados();
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
        this.carregarFaturamentoSemanal(currentUser.uid),
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
   * Carregar faturamento semanal
   */
  async carregarFaturamentoSemanal(salonId: string): Promise<void> {
    try {
      const hoje = new Date();
      const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const revenue: number[] = [0, 0, 0, 0, 0, 0, 0];
      let totalSemana = 0;

      // Calcular últimos 7 dias
      for (let i = 0; i < 7; i++) {
        const data = new Date(hoje);
        data.setDate(data.getDate() - i);
        const dataStr = data.toISOString().split('T')[0];
        
        const agendamentosRef = collection(this.firestore, 'agendamentos');
        const q = query(
          agendamentosRef,
          where('salonId', '==', salonId),
          where('data', '==', dataStr),
          where('status', 'in', ['confirmado', 'pendente'])
        );
        
        const snapshot = await getDocs(q);
        const valorDia = snapshot.docs.reduce((sum, doc) => {
          const agend = doc.data() as Agendamento;
          return sum + (agend.valorTotal || 0);
        }, 0);
        
        const diaSemana = data.getDay();
        revenue[diaSemana] = valorDia;
        totalSemana += valorDia;
      }

      this.weeklyRevenue = revenue;
      this.stats.weekRevenue = totalSemana;

    } catch (error) {
      console.error('Erro ao carregar faturamento semanal:', error);
    }
  }

  /**
   * Carregar taxa de comparecimento (compareceu vs cancelou/no-show)
   */
  async carregarTaxaComparecimento(salonId: string): Promise<void> {
    try {
      const hoje = new Date();
      let showed = 0;
      let noShow = 0;

      // Considerar últimos 7 dias
      for (let i = 0; i < 7; i++) {
        const data = new Date(hoje);
        data.setDate(data.getDate() - i);
        const dataStr = data.toISOString().split('T')[0];

        const agendamentosRef = collection(this.firestore, 'agendamentos');
        const q = query(
          agendamentosRef,
          where('salonId', '==', salonId),
          where('data', '==', dataStr),
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
      }

      this.attendanceStats = { showed, noShow };
    } catch (error) {
      console.error('Erro ao carregar taxa de comparecimento:', error);
    }
  }

  /**
   * Carregar serviços mais populares
   */
  async carregarServicosPopulares(salonId: string): Promise<void> {
    try {
      const agendamentosRef = collection(this.firestore, 'agendamentos');
      const q = query(
        agendamentosRef,
        where('salonId', '==', salonId)
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
        new Chart(ctx, {
          type: 'bar',
          data: {
            labels: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
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
        const labels = this.topServices.map(s => s.label);
        const data = this.topServices.map(s => s.count);
        const colors = ['#e91e63', '#ff6b6b', '#e91e63', '#ff6b6b', '#e91e63'];
        
        new Chart(servicesCtx, {
          type: 'bar',
          data: {
            labels: labels.length > 0 ? labels : ['Sem dados'],
            datasets: [
              {
                label: 'Quantidade',
                data: data.length > 0 ? data : [0],
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
        const showed = this.attendanceStats.showed;
        const noShow = this.attendanceStats.noShow;
        const hasData = showed > 0 || noShow > 0;

        new Chart(paymentsCtx, {
          type: 'bar',
          data: {
            labels: ['Compareceu', 'Cancelou/No-show'],
            datasets: [
              {
                label: 'Atendimentos',
                data: hasData ? [showed, noShow] : [0, 0],
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
}
