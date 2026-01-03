import { Component, OnInit, inject, Input, Output, EventEmitter, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { AuthService } from '../services/auth.service';
import { Firestore, doc, updateDoc, serverTimestamp, collection, addDoc, getDocs, deleteDoc, query, where } from '@angular/fire/firestore';
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

export interface Servico {
  id?: string;
  nome: string;
  valor: number;
  duracao: number; // em minutos
  descricao?: string;
  ativo: boolean;
  userId?: string;
  createdAt?: any;
  updatedAt?: any;
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
  imports: [CommonModule, FormsModule, SelectModule],
  templateUrl: './onboarding.component.html',
  styleUrls: ['./onboarding.component.css']
})
export class OnboardingComponent implements OnInit {
  private authService = inject(AuthService);
  private firestore = inject(Firestore);
  private profissionalService = inject(ProfissionalService);
  private isBrowser: boolean;

  @Input() visible: boolean = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() onComplete = new EventEmitter<void>();

  currentStep = 0;
  totalSteps = 6;
  isLoading = false;
  isSaving = false;
  errorMessage = '';

  selectedFile: File | null = null;
  previewUrl: string = '';

  // Serviços
  servicos: Servico[] = [];
  novoServico: Servico = {
    nome: '',
    valor: 0,
    duracao: 30,
    descricao: '',
    ativo: true
  };
  editandoServico: Servico | null = null;
  mostrarFormServico = false;

  // Profissionais
  profissionais: Profissional[] = [];
  novoProfissional: Omit<Profissional, 'id' | 'createdAt' | 'updatedAt'> = {
    salonId: '',
    nome: '',
    foto: '',
    descricao: '',
    interesses: [],
    ativo: true,
    ordem: 0
  };
  editandoProfissional: Profissional | null = null;
  mostrarFormProfissional = false;
  selectedFileProfissional: File | null = null;
  previewUrlProfissional: string = '';
  interesseTemp: string = '';

  // Opções de duração em minutos
  opcoesDuracao = [
    { valor: 15, label: '15 min' },
    { valor: 30, label: '30 min' },
    { valor: 45, label: '45 min' },
    { valor: 60, label: '1 hora' },
    { valor: 90, label: '1h 30min' },
    { valor: 120, label: '2 horas' },
    { valor: 150, label: '2h 30min' },
    { valor: 180, label: '3 horas' }
  ];

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
  estadoOptions = this.estados.map(uf => ({ label: uf, value: uf }));
  intervaloOptions = [
    { label: '0 minutos', value: 0 },
    { label: '5 minutos', value: 5 },
    { label: '10 minutos', value: 10 },
    { label: '15 minutos', value: 15 },
    { label: '30 minutos', value: 30 },
    { label: '45 minutos', value: 45 },
    { label: '1 hora', value: 60 }
  ];
  antecedenciaMinOptions = [
    { label: '1 hora', value: 1 },
    { label: '2 horas', value: 2 },
    { label: '4 horas', value: 4 },
    { label: '24 horas', value: 24 }
  ];
  antecedenciaMaxOptions = [
    { label: '7 dias', value: 7 },
    { label: '15 dias', value: 15 },
    { label: '30 dias', value: 30 },
    { label: '60 dias', value: 60 },
    { label: '90 dias', value: 90 }
  ];

  steps = [
    { label: 'Seu Salão', icon: 'fa-store' },
    { label: 'Localização', icon: 'fa-map-marker-alt' },
    { label: 'Horários', icon: 'fa-clock' },
    { label: 'Serviços', icon: 'fa-scissors' },
    { label: 'Equipe', icon: 'fa-users' },
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
      case 3:
        // Serviços (opcional)
        break;
      case 4:
        // Validar profissionais
        if (this.profissionais.length === 0) {
          this.errorMessage = 'Adicione pelo menos um profissional à sua equipe.';
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

      // Salvar serviços na coleção separada
      if (this.servicos.length > 0) {
        await this.salvarServicosNoFirestore();
      }

      // Salvar profissionais na coleção separada
      if (this.profissionais.length > 0) {
        await this.salvarProfissionaisNoFirestore();
      }

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

  // ========== Métodos de Serviços ==========

  abrirFormServico(): void {
    this.novoServico = {
      nome: '',
      valor: 0,
      duracao: 30,
      descricao: '',
      ativo: true
    };
    this.editandoServico = null;
    this.mostrarFormServico = true;
  }

  editarServico(servico: Servico, index: number): void {
    this.novoServico = { ...servico };
    this.editandoServico = servico;
    this.mostrarFormServico = true;
  }

  cancelarFormServico(): void {
    this.mostrarFormServico = false;
    this.editandoServico = null;
    this.novoServico = {
      nome: '',
      valor: 0,
      duracao: 30,
      descricao: '',
      ativo: true
    };
  }

  salvarServico(): void {
    if (!this.novoServico.nome.trim()) {
      this.errorMessage = 'Informe o nome do serviço.';
      return;
    }

    if (this.novoServico.valor <= 0) {
      this.errorMessage = 'Informe um valor válido para o serviço.';
      return;
    }

    this.errorMessage = '';

    if (this.editandoServico) {
      // Editar serviço existente
      const index = this.servicos.findIndex(s => s === this.editandoServico);
      if (index !== -1) {
        this.servicos[index] = { ...this.novoServico };
      }
    } else {
      // Adicionar novo serviço
      this.servicos.push({ ...this.novoServico });
    }

    this.cancelarFormServico();
  }

  removerServico(index: number): void {
    this.servicos.splice(index, 1);
  }

  formatarValor(valor: number): string {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatarDuracao(minutos: number): string {
    if (minutos < 60) {
      return `${minutos} min`;
    }
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    if (mins === 0) {
      return `${horas}h`;
    }
    return `${horas}h ${mins}min`;
  }

  async salvarServicosNoFirestore(): Promise<void> {
    const currentUser = this.authService.currentUser();
    if (!currentUser) return;

    const servicosRef = collection(this.firestore, 'servicos');

    // Salvar cada serviço
    for (const servico of this.servicos) {
      await addDoc(servicosRef, {
        ...servico,
        userId: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  }

  // ========== Métodos de Profissionais ==========

  abrirFormProfissional(): void {
    const currentUser = this.authService.currentUser();
    this.novoProfissional = {
      salonId: currentUser?.uid || '',
      nome: '',
      foto: '',
      descricao: '',
      interesses: [],
      ativo: true,
      ordem: this.profissionais.length
    };
    this.editandoProfissional = null;
    this.previewUrlProfissional = '';
    this.selectedFileProfissional = null;
    this.mostrarFormProfissional = true;
  }

  editarProfissional(profissional: Profissional, index: number): void {
    this.novoProfissional = { ...profissional };
    this.previewUrlProfissional = profissional.foto;
    this.editandoProfissional = profissional;
    this.mostrarFormProfissional = true;
  }

  cancelarFormProfissional(): void {
    this.mostrarFormProfissional = false;
    this.editandoProfissional = null;
    this.previewUrlProfissional = '';
    this.selectedFileProfissional = null;
    this.interesseTemp = '';
    const currentUser = this.authService.currentUser();
    this.novoProfissional = {
      salonId: currentUser?.uid || '',
      nome: '',
      foto: '',
      descricao: '',
      interesses: [],
      ativo: true,
      ordem: 0
    };
  }

  salvarProfissional(): void {
    if (!this.novoProfissional.nome.trim()) {
      this.errorMessage = 'Informe o nome do profissional.';
      return;
    }

    if (this.novoProfissional.nome.trim().length < 3) {
      this.errorMessage = 'Nome deve ter pelo menos 3 caracteres.';
      return;
    }

    if (!this.novoProfissional.descricao.trim()) {
      this.errorMessage = 'Informe uma descrição para o profissional.';
      return;
    }

    if (this.novoProfissional.descricao.trim().length < 10) {
      this.errorMessage = 'Descrição deve ter pelo menos 10 caracteres.';
      return;
    }

    if (!this.previewUrlProfissional) {
      this.errorMessage = 'Adicione uma foto do profissional.';
      return;
    }

    if (this.novoProfissional.interesses.length === 0) {
      this.errorMessage = 'Adicione pelo menos 1 interesse.';
      return;
    }

    this.errorMessage = '';

    // Adicionar a foto em base64
    this.novoProfissional.foto = this.previewUrlProfissional;

    if (this.editandoProfissional) {
      // Editar profissional existente
      const index = this.profissionais.findIndex(p => p === this.editandoProfissional);
      if (index !== -1) {
        this.profissionais[index] = { ...this.novoProfissional } as Profissional;
      }
    } else {
      // Adicionar novo profissional
      this.profissionais.push({ ...this.novoProfissional } as Profissional);
    }

    this.cancelarFormProfissional();
  }

  removerProfissional(index: number): void {
    this.profissionais.splice(index, 1);
    // Reordenar os profissionais
    this.profissionais.forEach((prof, i) => {
      prof.ordem = i;
    });
  }

  async onFileSelectedProfissional(event: Event): Promise<void> {
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

      this.selectedFileProfissional = file;

      try {
        // Comprimir imagem antes de converter para base64
        const compressedBase64 = await this.compressImage(file, 800, 0.7);
        this.previewUrlProfissional = compressedBase64;
        this.errorMessage = '';
      } catch (error) {
        console.error('Erro ao processar imagem:', error);
        this.errorMessage = 'Erro ao processar imagem. Tente novamente.';
      }
    }
  }

  /**
   * Comprimir imagem para reduzir tamanho do base64
   * @param file Arquivo de imagem
   * @param maxWidth Largura máxima (default 800px)
   * @param quality Qualidade JPEG (0-1, default 0.7)
   */
  private compressImage(file: File, maxWidth: number = 800, quality: number = 0.7): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const img = new Image();

        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Redimensionar mantendo proporção
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Não foi possível obter contexto do canvas'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Converter para base64 com compressão
          const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedBase64);
        };

        img.onerror = () => reject(new Error('Erro ao carregar imagem'));
        img.src = e.target?.result as string;
      };

      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsDataURL(file);
    });
  }

  removePhotoProfissional(): void {
    this.selectedFileProfissional = null;
    this.previewUrlProfissional = '';
  }

  adicionarInteresse(): void {
    const interesse = this.interesseTemp.trim();

    if (!interesse) {
      this.errorMessage = 'Digite um interesse antes de adicionar.';
      return;
    }

    if (interesse.length < 2) {
      this.errorMessage = 'Interesse deve ter pelo menos 2 caracteres.';
      return;
    }

    if (interesse.length > 50) {
      this.errorMessage = 'Interesse deve ter no máximo 50 caracteres.';
      return;
    }

    if (this.novoProfissional.interesses.length >= 10) {
      this.errorMessage = 'Máximo de 10 interesses permitidos.';
      return;
    }

    if (this.novoProfissional.interesses.includes(interesse)) {
      this.errorMessage = 'Este interesse já foi adicionado.';
      return;
    }

    this.novoProfissional.interesses.push(interesse);
    this.interesseTemp = '';
    this.errorMessage = '';
  }

  removerInteresse(index: number): void {
    this.novoProfissional.interesses.splice(index, 1);
  }

  async salvarProfissionaisNoFirestore(): Promise<void> {
    const currentUser = this.authService.currentUser();
    if (!currentUser) return;

    // Salvar cada profissional usando o ProfissionalService
    for (const profissional of this.profissionais) {
      await this.profissionalService.criar({
        salonId: currentUser.uid,
        nome: profissional.nome,
        foto: profissional.foto,
        descricao: profissional.descricao,
        interesses: profissional.interesses,
        ativo: profissional.ativo,
        ordem: profissional.ordem
      });
    }
  }
}
