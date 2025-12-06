import { Component, AfterViewInit, ViewChild, ElementRef, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SideMenuComponent } from '../side-menu/side-menu.component';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, SideMenuComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements AfterViewInit {
  @ViewChild('barCanvas', { static: false }) barCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('servicesCanvas', { static: false }) servicesCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('paymentsCanvas', { static: false }) paymentsCanvas!: ElementRef<HTMLCanvasElement>;

  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

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

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;

    // Faturamento semanal
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

    // Serviços Mais Realizados (horizontal bar)
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

    // Métodos de Pagamento (doughnut chart)
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
