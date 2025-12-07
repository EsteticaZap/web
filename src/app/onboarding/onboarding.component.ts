import { Component, OnInit, inject, Input, Output, EventEmitter, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { Firestore, doc, updateDoc, serverTimestamp } from '@angular/fire/firestore';

interface HorarioTrabalho {
  inicio: string;
  fim: string;
  ativo: boolean;
  temIntervalo: boolean;
  intervaloInicio: string;
  intervaloFim: string;
}

interface OnboardingData {
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
  fotoSalao: string;
}

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './onboarding.component.html',
  styleUrls: ['./onboarding.component.css']
})
export class OnboardingComponent implements OnInit {
  private authService = inject(AuthService);
  private firestore = inject(Firestore);
  private isBrowser: boolean;

  @Input() visible: boolean = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() onComplete = new EventEmitter<void>();

  currentStep = 0;
  totalSteps = 4;
  isLoading = false;
  isSaving = false;
  errorMessage = '';

  selectedFile: File | null = null;
  previewUrl: string = '';

  data: OnboardingData = {
    nomeSalao: '',
    telefone: '',
    whatsapp: '',
    descricao: '',
    endereco: '',
    cidade: '',
    estado: '',
    cep: '',
    horariosFuncionamento: {
      domingo: { inicio: '09:00', fim: '18:00', ativo: false, temIntervalo: false, intervaloInicio: '12:00', intervaloFim: '13:00' },
      segunda: { inicio: '09:00', fim: '18:00', ativo: true, temIntervalo: true, intervaloInicio: '12:00', intervaloFim: '13:00' },
      terca: { inicio: '09:00', fim: '18:00', ativo: true, temIntervalo: true, intervaloInicio: '12:00', intervaloFim: '13:00' },
      quarta: { inicio: '09:00', fim: '18:00', ativo: true, temIntervalo: true, intervaloInicio: '12:00', intervaloFim: '13:00' },
      quinta: { inicio: '09:00', fim: '18:00', ativo: true, temIntervalo: true, intervaloInicio: '12:00', intervaloFim: '13:00' },
      sexta: { inicio: '09:00', fim: '18:00', ativo: true, temIntervalo: true, intervaloInicio: '12:00', intervaloFim: '13:00' },
      sabado: { inicio: '09:00', fim: '14:00', ativo: true, temIntervalo: false, intervaloInicio: '12:00', intervaloFim: '13:00' }
    },
    intervaloAgendamento: 30,
    antecedenciaMinima: 2,
    antecedenciaMaxima: 30,
    fotoSalao: ''
  };

  diasSemana = [
    { key: 'domingo', nome: 'Domingo', abreviacao: 'Dom' },
    { key: 'segunda', nome: 'Segunda-feira', abreviacao: 'Seg' },
    { key: 'terca', nome: 'Terça-feira', abreviacao: 'Ter' },
    { key: 'quarta', nome: 'Quarta-feira', abreviacao: 'Qua' },
    { key: 'quinta', nome: 'Quinta-feira', abreviacao: 'Qui' },
    { key: 'sexta', nome: 'Sexta-feira', abreviacao: 'Sex' },
    { key: 'sabado', nome: 'Sábado', abreviacao: 'Sáb' }
  ];

  estados = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
    'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
    'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ];

  steps = [
    { label: 'Seu Salão', icon: 'fa-store' },
    { label: 'Localização', icon: 'fa-map-marker-alt' },
    { label: 'Horários', icon: 'fa-clock' },
    { label: 'Finalizar', icon: 'fa-check' }
  ];

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    const userData = this.authService.userData();
    if (userData?.displayName) {
      this.data.nomeSalao = userData.displayName;
    }
  }

  nextStep(): void {
    if (this.validateCurrentStep()) {
      if (this.currentStep < this.totalSteps - 1) {
        this.currentStep++;
        this.errorMessage = '';
      }
    }
  }

  prevStep(): void {
    if (this.currentStep > 0) {
      this.currentStep--;
      this.errorMessage = '';
    }
  }

  goToStep(index: number): void {
    if (index <= this.currentStep) {
      this.currentStep = index;
      this.errorMessage = '';
    }
  }

  validateCurrentStep(): boolean {
    switch (this.currentStep) {
      case 0:
        if (!this.data.nomeSalao.trim()) {
          this.errorMessage = 'Por favor, informe o nome do seu salão.';
          return false;
        }
        break;
      case 1:
        break;
      case 2:
        const temDiaAtivo = Object.values(this.data.horariosFuncionamento).some(h => h.ativo);
        if (!temDiaAtivo) {
          this.errorMessage = 'Selecione pelo menos um dia de funcionamento.';
          return false;
        }
        break;
    }
    this.errorMessage = '';
    return true;
  }

  getHorario(dia: string): HorarioTrabalho {
    return (this.data.horariosFuncionamento as any)[dia];
  }

  toggleDia(dia: string): void {
    (this.data.horariosFuncionamento as any)[dia].ativo = 
      !(this.data.horariosFuncionamento as any)[dia].ativo;
  }

  toggleIntervalo(dia: string): void {
    (this.data.horariosFuncionamento as any)[dia].temIntervalo = 
      !(this.data.horariosFuncionamento as any)[dia].temIntervalo;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      
      if (!file.type.startsWith('image/')) {
        this.errorMessage = 'Por favor, selecione apenas arquivos de imagem.';
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        this.errorMessage = 'A imagem deve ter no máximo 5MB.';
        return;
      }

      this.selectedFile = file;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        this.previewUrl = e.target?.result as string;
      };
      reader.readAsDataURL(file);
      
      this.errorMessage = '';
    }
  }

  removePhoto(): void {
    this.selectedFile = null;
    this.previewUrl = '';
  }

  getPhotoBase64(): string | null {
    // Retorna a imagem em base64 que já foi convertida no onFileSelected
    if (!this.previewUrl) return null;
    return this.previewUrl;
  }

  async finalizarOnboarding(): Promise<void> {
    if (!this.validateCurrentStep()) return;

    this.isSaving = true;
    this.errorMessage = '';

    try {
      const currentUser = this.authService.currentUser();
      if (!currentUser) {
        this.errorMessage = 'Usuário não autenticado.';
        return;
      }

      // Obtém a foto em base64 se houver arquivo selecionado
      const fotoBase64 = this.getPhotoBase64();
      if (fotoBase64) {
        this.data.fotoSalao = fotoBase64;
      }

      const userDocRef = doc(this.firestore, 'users', currentUser.uid);
      await updateDoc(userDocRef, {
        displayName: this.data.nomeSalao,
        fotoSalao: this.data.fotoSalao || null,
        onboardingCompleted: true,
        configuracoes: {
          nomeSalao: this.data.nomeSalao,
          telefone: this.data.telefone,
          whatsapp: this.data.whatsapp,
          descricao: this.data.descricao,
          endereco: this.data.endereco,
          cidade: this.data.cidade,
          estado: this.data.estado,
          cep: this.data.cep,
          horariosFuncionamento: this.data.horariosFuncionamento,
          intervaloAgendamento: this.data.intervaloAgendamento,
          antecedenciaMinima: this.data.antecedenciaMinima,
          antecedenciaMaxima: this.data.antecedenciaMaxima
        },
        updatedAt: serverTimestamp()
      });

      // Recarregar dados do usuário para atualizar o cache
      await this.authService.refreshUserData();

      this.closeModal();
      this.onComplete.emit();

    } catch (error: any) {
      console.error('Erro ao salvar configurações:', error);
      this.errorMessage = 'Erro ao salvar. Tente novamente.';
    } finally {
      this.isSaving = false;
    }
  }

  formatPhone(event: Event, field: 'telefone' | 'whatsapp'): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');
    
    if (value.length <= 10) {
      value = value.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    } else {
      value = value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    
    this.data[field] = value;
  }

  formatCep(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');
    value = value.replace(/(\d{5})(\d{3})/, '$1-$2');
    this.data.cep = value;
  }

  skipOnboarding(): void {
    this.closeModal();
  }

  closeModal(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  onOverlayClick(event: Event): void {
    // Não fechar ao clicar no overlay
    event.stopPropagation();
  }
}
