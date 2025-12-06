import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SideMenuComponent } from '../side-menu/side-menu.component';
import { SelectModule } from 'primeng/select';

interface ViewOption {
  label: string;
  value: string;
}

interface Appointment {
  id: string;
  client: string;
  service: string;
  startTime: string;
  endTime: string;
  day: number; // 0-6 (seg-dom)
  status: 'confirmed' | 'pending' | 'declined';
  image: string;
  price: string;
}

interface DailySummary {
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
export class AgendaComponent {
  isBrowser: boolean;
  currentView = 'weekly';
  
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
  appointments: Appointment[] = [
    { 
      id: '1',
      client: 'Juliana Santos', 
      service: 'Manicure e Pedicure',
      startTime: '08:00',
      endTime: '09:30',
      day: 3, // Quinta
      status: 'confirmed',
      image: '/girllandpage.png',
      price: 'R$ 45,00'
    },
    { 
      id: '2',
      client: 'Roberto Silva', 
      service: 'Corte Masculino',
      startTime: '10:00',
      endTime: '10:30',
      day: 0, // Segunda
      status: 'confirmed',
      image: '/girllandpage.png',
      price: 'R$ 35,00'
    },
    { 
      id: '3',
      client: 'Beatriz Lima', 
      service: 'Hidratação Capilar',
      startTime: '10:30',
      endTime: '12:00',
      day: 3, // Quinta
      status: 'confirmed',
      image: '/girllandpage.png',
      price: 'R$ 80,00'
    },
    { 
      id: '4',
      client: 'Fernanda Costa', 
      service: 'Progressiva em Gel',
      startTime: '14:00',
      endTime: '15:30',
      day: 0, // Segunda
      status: 'confirmed',
      image: '/girllandpage.png',
      price: 'R$ 120,00'
    },
    { 
      id: '5',
      client: 'Mariana Silva', 
      service: 'Corte e Coloração',
      startTime: '14:30',
      endTime: '17:00',
      day: 3, // Quinta
      status: 'confirmed',
      image: '/girllandpage.png',
      price: 'R$ 150,00'
    },
    { 
      id: '6',
      client: 'Carlos Mendes', 
      service: 'Corte Masculino',
      startTime: '17:30',
      endTime: '18:30',
      day: 3, // Quinta
      status: 'pending',
      image: '/girllandpage.png',
      price: 'R$ 35,00'
    },
    { 
      id: '7',
      client: 'Patricia Oliveira', 
      service: 'Escova Progressiva',
      startTime: '19:00',
      endTime: '20:30',
      day: 3, // Quinta
      status: 'declined',
      image: '/girllandpage.png',
      price: 'R$ 100,00'
    },
    { 
      id: '8',
      client: 'Camila Rocha', 
      service: 'Coloração',
      startTime: '16:00',
      endTime: '17:00',
      day: 1, // Terça
      status: 'confirmed',
      image: '/girllandpage.png',
      price: 'R$ 90,00'
    },
    { 
      id: '9',
      client: 'Carla Mendes', 
      service: 'Design de Sobrancelhas',
      startTime: '08:00',
      endTime: '09:00',
      day: 4, // Sexta
      status: 'confirmed',
      image: '/girllandpage.png',
      price: 'R$ 40,00'
    },
    { 
      id: '10',
      client: 'Ana Paula Costa', 
      service: 'Corte e Escova',
      startTime: '10:00',
      endTime: '11:30',
      day: 4, // Sexta
      status: 'declined',
      image: '/girllandpage.png',
      price: 'R$ 70,00'
    },
    { 
      id: '11',
      client: 'Rafael Santos', 
      service: 'Corte Masculino',
      startTime: '16:00',
      endTime: '16:30',
      day: 4, // Sexta
      status: 'confirmed',
      image: '/girllandpage.png',
      price: 'R$ 35,00'
    },
    { 
      id: '12',
      client: 'Pedro Oliveira', 
      service: 'Barba e Bigode',
      startTime: '12:30',
      endTime: '13:00',
      day: 5, // Sábado
      status: 'confirmed',
      image: '/girllandpage.png',
      price: 'R$ 25,00'
    },
    { 
      id: '13',
      client: 'Lucas Pereira', 
      service: 'Corte Social',
      startTime: '14:00',
      endTime: '14:30',
      day: 6, // Domingo
      status: 'confirmed',
      image: '/girllandpage.png',
      price: 'R$ 40,00'
    }
  ];

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
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
    
    return this.appointments.filter(appt => {
      if (appt.day !== dayIndex) return false;
      
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
    const dayOfWeek = this.currentDay.getDay();
    // Converter domingo (0) para índice 6, segunda (1) para 0, etc.
    const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    
    return this.appointments
      .filter(appt => appt.day === dayIndex)
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
}
