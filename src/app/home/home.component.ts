import { Component, AfterViewInit, ViewChild, ElementRef, Inject, PLATFORM_ID, OnInit, inject, effect } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SideMenuComponent } from '../side-menu/side-menu.component';
import { OnboardingComponent } from '../onboarding/onboarding.component';
import { AuthService } from '../services/auth.service';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, SideMenuComponent, OnboardingComponent],
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

  // Modal de onboarding
  showOnboarding = false;
  onboardingChecked = false;

  userName = 'Maria';
  nextAppointment = {
    client: 'Ana Paula Costa',
    time: '14:30',
    service: 'Corte e Escova',
    remaining: '45min'
  };
  stats = {
    today: 8,
    weekRevenue: 2840,
    activeClients: 127
  };
  appointments = [
    { time: '10:00', name: 'Juliana Santos', service: 'Manicure e Pedicure', status: 'Confirmado', image: '/girllandpage.png' },
    { time: '11:30', name: 'Carla Mendes', service: 'Design de Sobrancelhas', status: 'Confirmado', image: '/girllandpage.png' },
    { time: '14:30', name: 'Ana Paula Costa', service: 'Corte e Escova', status: 'Próximo', image: '/girllandpage.png' },
    { time: '16:00', name: 'Beatriz Lima', service: 'Hidratação Capilar', status: 'Pendente', image: '/girllandpage.png' }
  ];

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
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;

    // Delay para garantir que o DOM está pronto
    setTimeout(() => {
      this.initCharts();
    }, 100);
  }

  private initCharts(): void {
    // Faturamento semanal
    if (this.barCanvas?.nativeElement) {
      const ctx = this.barCanvas.nativeElement.getContext('2d');
      if (ctx) {
        new Chart(ctx, {
          type: 'bar',
          data: {
            labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
            datasets: [
              {
                label: 'Faturamento',
                data: [300, 450, 350, 500, 600, 700, 400],
                backgroundColor: '#38b000'
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: { beginAtZero: true }
            }
          }
        });
      }
    }

    // Serviços Mais Realizados (horizontal bar)
    if (this.servicesCanvas?.nativeElement) {
      const servicesCtx = this.servicesCanvas.nativeElement.getContext('2d');
      if (servicesCtx) {
        new Chart(servicesCtx, {
          type: 'bar',
          data: {
            labels: ['Hidratação', 'Sobrancelha', 'Escova', 'Manicure', 'Corte'],
            datasets: [
              {
                label: 'Serviços',
                data: [25, 30, 35, 40, 45],
                backgroundColor: ['#ff6b6b', '#38b000', '#ff6b6b', '#38b000', '#ff6b6b']
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

    // Métodos de Pagamento (doughnut chart)
    if (this.paymentsCanvas?.nativeElement) {
      const paymentsCtx = this.paymentsCanvas.nativeElement.getContext('2d');
      if (paymentsCtx) {
        new Chart(paymentsCtx, {
          type: 'doughnut',
          data: {
            labels: ['Pix', 'Cartão', 'Dinheiro'],
            datasets: [
              {
                data: [55, 30, 15],
                backgroundColor: ['#38b000', '#ff6b6b', '#868e96']
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false
          }
        });
      }
    }
  }
}
