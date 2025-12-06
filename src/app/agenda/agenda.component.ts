import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { SideMenuComponent } from '../side-menu/side-menu.component';

interface Appointment {
  id: string;
  client: string;
  service: string;
  startTime: string;
  endTime: string;
  day: number; // 0-6 (seg-dom)
  status: 'confirmed' | 'pending' | 'declined';
  image: string;
}

@Component({
  selector: 'app-agenda',
  standalone: true,
  imports: [CommonModule, SideMenuComponent],
  templateUrl: './agenda.component.html',
  styleUrls: ['./agenda.component.css']
})
export class AgendaComponent {
  isBrowser: boolean;
  currentView = 'weekly';
  
  // Data atual da semana
  currentWeekStart = new Date(2024, 10, 18); // 18 de novembro de 2024 (segunda-feira)
  
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

  // Agendamentos
  appointments: Appointment[] = [
    { 
      id: '1',
      client: 'Juliana Santos', 
      service: 'Manicure e Pedicure',
      startTime: '08:00',
      endTime: '09:30',
      day: 1, // Terça
      status: 'confirmed',
      image: '/girllandpage.png'
    },
    { 
      id: '2',
      client: 'Roberto Silva', 
      service: 'Corte Masculino',
      startTime: '10:00',
      endTime: '10:30',
      day: 0, // Segunda
      status: 'confirmed',
      image: '/girllandpage.png'
    },
    { 
      id: '3',
      client: 'Beatriz Lima', 
      service: 'Hidratação Capilar',
      startTime: '10:30',
      endTime: '12:00',
      day: 2, // Quarta
      status: 'pending',
      image: '/girllandpage.png'
    },
    { 
      id: '4',
      client: 'Fernanda Costa', 
      service: 'Progressiva em Gel',
      startTime: '14:00',
      endTime: '15:30',
      day: 0, // Segunda
      status: 'confirmed',
      image: '/girllandpage.png'
    },
    { 
      id: '5',
      client: 'Camila Rocha', 
      service: 'Coloração',
      startTime: '16:00',
      endTime: '17:00',
      day: 1, // Terça
      status: 'confirmed',
      image: '/girllandpage.png'
    },
    { 
      id: '6',
      client: 'Carla Mendes', 
      service: 'Design de Sobrancelhas',
      startTime: '08:00',
      endTime: '09:00',
      day: 4, // Sexta
      status: 'confirmed',
      image: '/girllandpage.png'
    },
    { 
      id: '7',
      client: 'Mariana Silva', 
      service: 'Corte e Coloração',
      startTime: '14:30',
      endTime: '17:00',
      day: 2, // Quarta
      status: 'confirmed',
      image: '/girllandpage.png'
    },
    { 
      id: '8',
      client: 'Ana Paula Costa', 
      service: 'Corte e Escova',
      startTime: '10:00',
      endTime: '11:30',
      day: 4, // Sexta
      status: 'declined',
      image: '/girllandpage.png'
    },
    { 
      id: '9',
      client: 'Rafael Santos', 
      service: 'Corte Masculino',
      startTime: '16:00',
      endTime: '16:30',
      day: 4, // Sexta
      status: 'confirmed',
      image: '/girllandpage.png'
    },
    { 
      id: '10',
      client: 'Pedro Oliveira', 
      service: 'Barba e Bigode',
      startTime: '12:30',
      endTime: '13:00',
      day: 5, // Sábado
      status: 'confirmed',
      image: '/girllandpage.png'
    },
    { 
      id: '11',
      client: 'Lucas Pereira', 
      service: 'Corte Social',
      startTime: '14:00',
      endTime: '14:30',
      day: 6, // Domingo
      status: 'confirmed',
      image: '/girllandpage.png'
    }
  ];

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  get weekNumber(): number {
    const startOfYear = new Date(this.currentWeekStart.getFullYear(), 0, 1);
    const days = Math.floor((this.currentWeekStart.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + startOfYear.getDay() + 1) / 7);
  }

  get weekDateRange(): string {
    const start = this.currentWeekStart;
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()} - ${end.getDate()} ${months[start.getMonth()]} ${start.getFullYear()}`;
    } else {
      return `${start.getDate()} ${months[start.getMonth()]} - ${end.getDate()} ${months[end.getMonth()]} ${end.getFullYear()}`;
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
      const apptEndHour = parseInt(appt.endTime.split(':')[0]);
      
      // Verifica se o agendamento começa neste slot ou continua nele
      return apptStartHour >= slotHour && apptStartHour < slotHour + 2;
    });
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'confirmed': return 'status-confirmed';
      case 'pending': return 'status-pending';
      case 'declined': return 'status-declined';
      default: return '';
    }
  }

  changeView(view: string): void {
    this.currentView = view;
  }
}
