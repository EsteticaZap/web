import { Component, OnInit, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, UserData } from '../services/auth.service';
import { Firestore, doc, updateDoc, serverTimestamp, collection, addDoc, getDocs, deleteDoc, query, where } from '@angular/fire/firestore';
import { SideMenuComponent } from '../side-menu/side-menu.component';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { Servico } from '../onboarding/onboarding.component';

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
  imports: [CommonModule, FormsModule, SideMenuComponent, ToastModule],
  providers: [MessageService],
  templateUrl: './configuracoes.component.html',
  styleUrls: ['./configuracoes.component.css']
})
export class ConfiguracoesComponent implements OnInit {
  private authService = inject(AuthService);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private messageService = inject(MessageService);
  private dataLoaded = false;

  isLoading = true;
  isSaving = false;
  successMessage = '';
  errorMessage = '';
  activeTab = 'info'; // info, horarios, avancado

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

    this.isLoading = false;
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;
    this.clearMessages();
    
    // Carregar serviços quando acessar a aba
    if (tab === 'servicos' && this.servicos.length === 0) {
      this.carregarServicos();
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
}
