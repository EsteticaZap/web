import { Component, OnInit, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, UserData } from '../services/auth.service';
import { Firestore, doc, updateDoc, serverTimestamp, collection, addDoc, getDocs, deleteDoc, query, where } from '@angular/fire/firestore';
import { SideMenuComponent } from '../side-menu/side-menu.component';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { AvatarModule } from 'primeng/avatar';
import { TagModule } from 'primeng/tag';
import { ChipModule } from 'primeng/chip';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { MessageService } from 'primeng/api';
import { Servico } from '../onboarding/onboarding.component';
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

interface DiaSemana {
  nome: string;
  abreviacao: string;
  horarios: HorarioTrabalho;
}

export interface ConfiguracoesSalao {
  // Informações básicas
  nomeSalao: string;
  telefone: string;
  whatsapp: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
  descricao: string;
  fotoSalao: string;
  
  // Horários de funcionamento
  horariosFuncionamento: {
    domingo: HorarioTrabalho;
    segunda: HorarioTrabalho;
    terca: HorarioTrabalho;
    quarta: HorarioTrabalho;
    quinta: HorarioTrabalho;
    sexta: HorarioTrabalho;
    sabado: HorarioTrabalho;
  };
  
  // Configurações adicionais
  intervaloAgendamento: number; // em minutos
  antecedenciaMinima: number; // em horas
  antecedenciaMaxima: number; // em dias
}

@Component({
  selector: 'app-configuracoes',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SideMenuComponent,
    ToastModule,
    DialogModule,
    ButtonModule,
    CardModule,
    AvatarModule,
    TagModule,
    ChipModule,
    InputTextModule,
    InputTextareaModule
  ],
  providers: [MessageService],
  templateUrl: './configuracoes.component.html',
  styleUrls: ['./configuracoes.component.css']
})
export class ConfiguracoesComponent implements OnInit {
  private authService = inject(AuthService);
  private firestore = inject(Firestore);
  private profissionalService = inject(ProfissionalService);
  private router = inject(Router);
  private messageService = inject(MessageService);
  private dataLoaded = false;

  isLoading = true;
  isSaving = false;
  successMessage = '';
  errorMessage = '';
  activeTab = 'info'; // info, horarios, servicos, equipe, avancado

  // Foto do salão
  selectedFile: File | null = null;
  previewUrl: string = '';
  uploadProgress = 0;

  // Configurações do salão
  config: ConfiguracoesSalao = {
    nomeSalao: '',
    telefone: '',
    whatsapp: '',
    endereco: '',
    cidade: '',
    estado: '',
    cep: '',
    descricao: '',
    fotoSalao: '',
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
    antecedenciaMaxima: 30
  };

  // Dias da semana para iteração
  diasSemana = [
    { key: 'domingo', nome: 'Domingo', abreviacao: 'Dom' },
    { key: 'segunda', nome: 'Segunda-feira', abreviacao: 'Seg' },
    { key: 'terca', nome: 'Terça-feira', abreviacao: 'Ter' },
    { key: 'quarta', nome: 'Quarta-feira', abreviacao: 'Qua' },
    { key: 'quinta', nome: 'Quinta-feira', abreviacao: 'Qui' },
    { key: 'sexta', nome: 'Sexta-feira', abreviacao: 'Sex' },
    { key: 'sabado', nome: 'Sábado', abreviacao: 'Sáb' }
  ];

  // Estados brasileiros
  estados = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
    'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
    'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ];

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
  isLoadingServicos = false;
  isSavingServico = false;

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
  isLoadingProfissionais = false;
  isSavingProfissional = false;
  selectedFileProfissional: File | null = null;
  previewUrlProfissional: string = '';
  interesseTemp: string = '';

  // Alias para o HTML (compatibilidade)
  get novoInteresse(): string {
    return this.interesseTemp;
  }

  set novoInteresse(value: string) {
    this.interesseTemp = value;
  }

  constructor() {
    // Effect para reagir quando os dados do usuário estiverem disponíveis
    effect(() => {
      const userData = this.authService.userData();
      const isAuthLoading = this.authService.isLoading();
      
      // Só carrega os dados se não estiver mais carregando a autenticação
      // e se ainda não foram carregados
      if (!isAuthLoading && userData && !this.dataLoaded) {
        this.dataLoaded = true;
        this.loadUserData();
      } else if (!isAuthLoading && !userData) {
        this.isLoading = false;
      }
    });
  }

  ngOnInit(): void {
    // O carregamento agora é feito pelo effect
  }

  loadUserData(): void {
    this.isLoading = true;
    const userData = this.authService.userData();
    const currentUser = this.authService.currentUser();

    if (userData) {
      const configuracoes = (userData as any).configuracoes;
      
      // Carregar dados básicos das configurações salvas
      if (configuracoes) {
        this.config.nomeSalao = configuracoes.nomeSalao || userData.displayName || '';
        this.config.telefone = configuracoes.telefone || '';
        this.config.whatsapp = configuracoes.whatsapp || '';
        this.config.endereco = configuracoes.endereco || '';
        this.config.cidade = configuracoes.cidade || '';
        this.config.estado = configuracoes.estado || '';
        this.config.cep = configuracoes.cep || '';
        this.config.descricao = configuracoes.descricao || '';
        this.config.intervaloAgendamento = configuracoes.intervaloAgendamento || 30;
        this.config.antecedenciaMinima = configuracoes.antecedenciaMinima || 2;
        this.config.antecedenciaMaxima = configuracoes.antecedenciaMaxima || 30;
        
        // Carregar horários de funcionamento com merge profundo
        if (configuracoes.horariosFuncionamento) {
          Object.keys(configuracoes.horariosFuncionamento).forEach(dia => {
            if ((this.config.horariosFuncionamento as any)[dia]) {
              (this.config.horariosFuncionamento as any)[dia] = {
                ...(this.config.horariosFuncionamento as any)[dia],
                ...configuracoes.horariosFuncionamento[dia]
              };
            }
          });
        }
      } else {
        // Se não há configurações, usar o displayName
        this.config.nomeSalao = userData.displayName || '';
      }
      
      // Carregar foto do salão (base64)
      if ((userData as any).fotoSalao) {
        this.config.fotoSalao = (userData as any).fotoSalao;
        this.previewUrl = (userData as any).fotoSalao;
      }
    }

    // Carregar serviços
    this.carregarServicos();

    // Carregar profissionais
    this.carregarProfissionais();

    this.isLoading = false;
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;
    this.clearMessages();

    // Carregar serviços quando acessar a aba
    if (tab === 'servicos' && this.servicos.length === 0) {
      this.carregarServicos();
    }

    // Carregar profissionais quando acessar a aba
    if (tab === 'equipe' && this.profissionais.length === 0) {
      this.carregarProfissionais();
    }
  }

  clearMessages(): void {
    this.successMessage = '';
    this.errorMessage = '';
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      
      // Validar tipo de arquivo
      if (!file.type.startsWith('image/')) {
        this.errorMessage = 'Por favor, selecione apenas arquivos de imagem.';
        return;
      }

      // Validar tamanho (máx 5MB)
      if (file.size > 5 * 1024 * 1024) {
        this.errorMessage = 'A imagem deve ter no máximo 5MB.';
        return;
      }

      this.selectedFile = file;
      
      // Criar preview
      const reader = new FileReader();
      reader.onload = (e) => {
        this.previewUrl = e.target?.result as string;
      };
      reader.readAsDataURL(file);
      
      this.clearMessages();
    }
  }

  removePhoto(): void {
    this.selectedFile = null;
    this.previewUrl = '';
    this.config.fotoSalao = '';
  }

  getPhotoBase64(): string | null {
    // Se há um novo arquivo selecionado, retorna o preview (base64)
    if (this.previewUrl) {
      return this.previewUrl;
    }
    // Caso contrário, retorna a foto existente
    return this.config.fotoSalao || null;
  }

  getHorario(dia: string): HorarioTrabalho {
    return (this.config.horariosFuncionamento as any)[dia];
  }

  toggleDia(dia: string): void {
    (this.config.horariosFuncionamento as any)[dia].ativo = 
      !(this.config.horariosFuncionamento as any)[dia].ativo;
  }

  toggleIntervalo(dia: string): void {
    (this.config.horariosFuncionamento as any)[dia].temIntervalo = 
      !(this.config.horariosFuncionamento as any)[dia].temIntervalo;
  }

  aplicarHorarioPadrao(): void {
    const horarioPadrao = { inicio: '09:00', fim: '18:00' };
    
    Object.keys(this.config.horariosFuncionamento).forEach(dia => {
      if ((this.config.horariosFuncionamento as any)[dia].ativo) {
        (this.config.horariosFuncionamento as any)[dia].inicio = horarioPadrao.inicio;
        (this.config.horariosFuncionamento as any)[dia].fim = horarioPadrao.fim;
      }
    });

    this.successMessage = 'Horário padrão aplicado aos dias ativos.';
    setTimeout(() => this.clearMessages(), 3000);
  }

  async salvarConfiguracoes(): Promise<void> {
    this.isSaving = true;
    this.clearMessages();

    try {
      const currentUser = this.authService.currentUser();
      if (!currentUser) {
        this.errorMessage = 'Usuário não autenticado.';
        return;
      }

      // Obtém a foto em base64 (nova ou existente)
      const fotoBase64 = this.getPhotoBase64();
      if (fotoBase64) {
        this.config.fotoSalao = fotoBase64;
      }

      // Atualizar documento no Firestore
      const userDocRef = doc(this.firestore, 'users', currentUser.uid);
      await updateDoc(userDocRef, {
        displayName: this.config.nomeSalao,
        fotoSalao: this.config.fotoSalao || null,
        configuracoes: {
          nomeSalao: this.config.nomeSalao,
          telefone: this.config.telefone,
          whatsapp: this.config.whatsapp,
          endereco: this.config.endereco,
          cidade: this.config.cidade,
          estado: this.config.estado,
          cep: this.config.cep,
          descricao: this.config.descricao,
          horariosFuncionamento: this.config.horariosFuncionamento,
          intervaloAgendamento: this.config.intervaloAgendamento,
          antecedenciaMinima: this.config.antecedenciaMinima,
          antecedenciaMaxima: this.config.antecedenciaMaxima
        },
        updatedAt: serverTimestamp()
      });

      this.selectedFile = null;
      
      // Exibir toast de sucesso
      this.messageService.add({
        severity: 'success',
        summary: 'Sucesso',
        detail: 'Configurações salvas com sucesso!',
        life: 3000
      });
      
      // Atualizar o cache do AuthService em background
      this.authService.refreshUserData();

    } catch (error: any) {
      console.error('Erro ao salvar configurações:', error);
      
      // Exibir toast de erro
      this.messageService.add({
        severity: 'error',
        summary: 'Erro',
        detail: 'Erro ao salvar configurações. Tente novamente.',
        life: 5000
      });
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
    
    this.config[field] = value;
  }

  formatCep(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');
    value = value.replace(/(\d{5})(\d{3})/, '$1-$2');
    this.config.cep = value;
  }

  // ========== Métodos de Serviços ==========

  async carregarServicos(): Promise<void> {
    const currentUser = this.authService.currentUser();
    if (!currentUser) return;

    this.isLoadingServicos = true;
    try {
      const servicosRef = collection(this.firestore, 'servicos');
      const q = query(servicosRef, where('userId', '==', currentUser.uid));
      const snapshot = await getDocs(q);
      
      this.servicos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Servico));
    } catch (error) {
      console.error('Erro ao carregar serviços:', error);
    } finally {
      this.isLoadingServicos = false;
    }
  }

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

  editarServico(servico: Servico): void {
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

  async salvarServico(): Promise<void> {
    if (!this.novoServico.nome.trim()) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Atenção',
        detail: 'Informe o nome do serviço.',
        life: 3000
      });
      return;
    }

    if (this.novoServico.valor <= 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Atenção',
        detail: 'Informe um valor válido para o serviço.',
        life: 3000
      });
      return;
    }

    const currentUser = this.authService.currentUser();
    if (!currentUser) return;

    this.isSavingServico = true;

    try {
      if (this.editandoServico && this.editandoServico.id) {
        // Atualizar serviço existente
        const servicoRef = doc(this.firestore, 'servicos', this.editandoServico.id);
        await updateDoc(servicoRef, {
          nome: this.novoServico.nome,
          valor: this.novoServico.valor,
          duracao: this.novoServico.duracao,
          descricao: this.novoServico.descricao || '',
          ativo: this.novoServico.ativo,
          updatedAt: serverTimestamp()
        });

        // Atualizar na lista local
        const index = this.servicos.findIndex(s => s.id === this.editandoServico!.id);
        if (index !== -1) {
          this.servicos[index] = { ...this.novoServico, id: this.editandoServico.id };
        }

        this.messageService.add({
          severity: 'success',
          summary: 'Sucesso',
          detail: 'Serviço atualizado com sucesso!',
          life: 3000
        });
      } else {
        // Criar novo serviço
        const servicosRef = collection(this.firestore, 'servicos');
        const docRef = await addDoc(servicosRef, {
          ...this.novoServico,
          userId: currentUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        // Adicionar na lista local
        this.servicos.push({ ...this.novoServico, id: docRef.id });

        this.messageService.add({
          severity: 'success',
          summary: 'Sucesso',
          detail: 'Serviço adicionado com sucesso!',
          life: 3000
        });
      }

      this.cancelarFormServico();
    } catch (error) {
      console.error('Erro ao salvar serviço:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Erro',
        detail: 'Erro ao salvar serviço. Tente novamente.',
        life: 5000
      });
    } finally {
      this.isSavingServico = false;
    }
  }

  async removerServico(servico: Servico): Promise<void> {
    if (!servico.id) return;

    try {
      await deleteDoc(doc(this.firestore, 'servicos', servico.id));
      this.servicos = this.servicos.filter(s => s.id !== servico.id);
      
      this.messageService.add({
        severity: 'success',
        summary: 'Sucesso',
        detail: 'Serviço removido com sucesso!',
        life: 3000
      });
    } catch (error) {
      console.error('Erro ao remover serviço:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Erro',
        detail: 'Erro ao remover serviço. Tente novamente.',
        life: 5000
      });
    }
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

  // ========== Métodos de Profissionais ==========

  async carregarProfissionais(): Promise<void> {
    const currentUser = this.authService.currentUser();
    if (!currentUser) return;

    this.isLoadingProfissionais = true;
    try {
      this.profissionais = await this.profissionalService.listarPorSalao(currentUser.uid);
    } catch (error) {
      console.error('Erro ao carregar profissionais:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Erro',
        detail: 'Erro ao carregar profissionais.',
        life: 3000
      });
    } finally {
      this.isLoadingProfissionais = false;
    }
  }

  abrirFormProfissional(profissional?: Profissional): void {
    const currentUser = this.authService.currentUser();

    if (profissional) {
      // Editar
      this.novoProfissional = { ...profissional };
      this.previewUrlProfissional = profissional.foto;
      this.editandoProfissional = profissional;
    } else {
      // Criar novo
      this.novoProfissional = {
        salonId: currentUser?.uid || '',
        nome: '',
        foto: '',
        descricao: '',
        interesses: [],
        ativo: true,
        ordem: this.profissionais.length
      };
      this.previewUrlProfissional = '';
      this.editandoProfissional = null;
    }

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

  async salvarProfissional(): Promise<void> {
    if (!this.novoProfissional.nome.trim()) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Atenção',
        detail: 'Informe o nome do profissional.',
        life: 3000
      });
      return;
    }

    if (!this.novoProfissional.descricao.trim()) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Atenção',
        detail: 'Informe uma descrição para o profissional.',
        life: 3000
      });
      return;
    }

    if (!this.previewUrlProfissional) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Atenção',
        detail: 'Adicione uma foto do profissional.',
        life: 3000
      });
      return;
    }

    if (this.novoProfissional.interesses.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Atenção',
        detail: 'Adicione pelo menos 1 interesse.',
        life: 3000
      });
      return;
    }

    const currentUser = this.authService.currentUser();
    if (!currentUser) return;

    this.isSavingProfissional = true;

    // Adicionar foto em base64
    this.novoProfissional.foto = this.previewUrlProfissional;

    try {
      if (this.editandoProfissional && this.editandoProfissional.id) {
        // Atualizar profissional existente
        await this.profissionalService.atualizar(this.editandoProfissional.id, {
          nome: this.novoProfissional.nome,
          foto: this.novoProfissional.foto,
          descricao: this.novoProfissional.descricao,
          interesses: this.novoProfissional.interesses,
          ativo: this.novoProfissional.ativo,
          ordem: this.novoProfissional.ordem
        });

        // Atualizar na lista local
        const index = this.profissionais.findIndex(p => p.id === this.editandoProfissional!.id);
        if (index !== -1) {
          this.profissionais[index] = { ...this.novoProfissional, id: this.editandoProfissional.id } as Profissional;
        }

        this.messageService.add({
          severity: 'success',
          summary: 'Sucesso',
          detail: 'Profissional atualizado com sucesso!',
          life: 3000
        });
      } else {
        // Criar novo profissional
        const profissionalId = await this.profissionalService.criar({
          salonId: currentUser.uid,
          nome: this.novoProfissional.nome,
          foto: this.novoProfissional.foto,
          descricao: this.novoProfissional.descricao,
          interesses: this.novoProfissional.interesses,
          ativo: true,
          ordem: this.profissionais.length
        });

        // Adicionar na lista local
        this.profissionais.push({ ...this.novoProfissional, id: profissionalId } as Profissional);

        this.messageService.add({
          severity: 'success',
          summary: 'Sucesso',
          detail: 'Profissional adicionado com sucesso!',
          life: 3000
        });
      }

      this.cancelarFormProfissional();
    } catch (error: any) {
      console.error('Erro ao salvar profissional:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Erro',
        detail: error.message || 'Erro ao salvar profissional. Tente novamente.',
        life: 5000
      });
    } finally {
      this.isSavingProfissional = false;
    }
  }

  async desativarProfissional(profissional: Profissional): Promise<void> {
    if (!profissional.id) return;

    // Verificar se é o último profissional ativo
    const ativosRestantes = this.profissionais.filter(p => p.ativo && p.id !== profissional.id);

    if (ativosRestantes.length === 0) {
      this.messageService.add({
        severity: 'error',
        summary: 'Operação Bloqueada',
        detail: 'Você deve ter pelo menos um profissional ativo. Adicione outro antes de desativar este.',
        life: 6000
      });
      return;
    }

    try {
      await this.profissionalService.desativar(profissional.id);

      // Atualizar na lista local
      const index = this.profissionais.findIndex(p => p.id === profissional.id);
      if (index !== -1) {
        this.profissionais[index].ativo = false;
      }

      this.messageService.add({
        severity: 'success',
        summary: 'Sucesso',
        detail: 'Profissional desativado com sucesso!',
        life: 3000
      });
    } catch (error) {
      console.error('Erro ao desativar profissional:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Erro',
        detail: 'Erro ao desativar profissional. Tente novamente.',
        life: 5000
      });
    }
  }

  async reativarProfissional(profissional: Profissional): Promise<void> {
    if (!profissional.id) return;

    try {
      await this.profissionalService.reativar(profissional.id);

      // Atualizar na lista local
      const index = this.profissionais.findIndex(p => p.id === profissional.id);
      if (index !== -1) {
        this.profissionais[index].ativo = true;
      }

      this.messageService.add({
        severity: 'success',
        summary: 'Sucesso',
        detail: 'Profissional reativado com sucesso!',
        life: 3000
      });
    } catch (error) {
      console.error('Erro ao reativar profissional:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Erro',
        detail: 'Erro ao reativar profissional. Tente novamente.',
        life: 5000
      });
    }
  }

  async onFileSelectedProfissional(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];

      if (!file.type.startsWith('image/')) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Atenção',
          detail: 'Por favor, selecione apenas arquivos de imagem.',
          life: 3000
        });
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Atenção',
          detail: 'A imagem deve ter no máximo 5MB.',
          life: 3000
        });
        return;
      }

      this.selectedFileProfissional = file;

      try {
        // Comprimir imagem antes de converter para base64
        const compressedBase64 = await this.compressImage(file, 800, 0.7);
        this.previewUrlProfissional = compressedBase64;
      } catch (error) {
        console.error('Erro ao processar imagem:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Erro',
          detail: 'Erro ao processar imagem. Tente novamente.',
          life: 3000
        });
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
      this.messageService.add({
        severity: 'warn',
        summary: 'Atenção',
        detail: 'Digite um interesse antes de adicionar.',
        life: 3000
      });
      return;
    }

    if (interesse.length < 2) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Atenção',
        detail: 'Interesse deve ter pelo menos 2 caracteres.',
        life: 3000
      });
      return;
    }

    if (this.novoProfissional.interesses.length >= 10) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Atenção',
        detail: 'Máximo de 10 interesses permitidos.',
        life: 3000
      });
      return;
    }

    if (this.novoProfissional.interesses.includes(interesse)) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Atenção',
        detail: 'Este interesse já foi adicionado.',
        life: 3000
      });
      return;
    }

    this.novoProfissional.interesses.push(interesse);
    this.interesseTemp = '';
  }

  removerInteresse(index: number): void {
    this.novoProfissional.interesses.splice(index, 1);
  }

  /**
   * Fechar formulário de profissional
   */
  fecharFormProfissional(): void {
    this.mostrarFormProfissional = false;
    this.editandoProfissional = null;
    this.novoProfissional = {
      salonId: '',
      nome: '',
      foto: '',
      descricao: '',
      interesses: [],
      ativo: true,
      ordem: 0
    };
    this.previewUrlProfissional = '';
    this.selectedFileProfissional = null;
    this.interesseTemp = '';
  }

  /**
   * Validar formulário de profissional
   */
  validarFormProfissional(): boolean {
    return !!(
      this.novoProfissional.nome.trim() &&
      this.novoProfissional.foto.trim() &&
      this.novoProfissional.descricao.trim() &&
      this.novoProfissional.interesses.length > 0
    );
  }

  /**
   * Alias para compatibilidade com HTML
   */
  onFileChangeProfissional(event: Event): void {
    this.onFileSelectedProfissional(event);
  }
}
