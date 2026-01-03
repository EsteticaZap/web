import { Component, Inject, PLATFORM_ID, OnInit, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatePickerModule } from 'primeng/datepicker';
import { ClienteService, Cliente as ClienteFirestore } from '../services/cliente.service';
import { AuthService } from '../services/auth.service';
import { Timestamp } from '@angular/fire/firestore';

interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  email?: string;
  avatar?: string;
  dataCadastro: Date;
  ultimaVisita: Date | null;
  totalVisitas: number;
  totalGasto: number;
  servicosPreferidos: string[];
  datasAgendamentos: string[];
  status: 'ativo' | 'inativo';
  observacoes?: string;
  aniversario: Date | null;
}

interface ClienteSummary {
  total: number;
  ativos: number;
  inativos: number;
  novosEsteMes: number;
}

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePickerModule],
  templateUrl: './clientes.component.html',
  styleUrls: ['./clientes.component.css']
})
export class ClientesComponent implements OnInit {
  private clienteService = inject(ClienteService);
  private authService = inject(AuthService);
  
  isBrowser: boolean;
  searchTerm = '';
  selectedFilter = 'todos';
  showModal = false;
  showDeleteModal = false;
  editingCliente: Cliente | null = null;
  clienteParaExcluir: Cliente | null = null;
  isLoading = true;
  
  // Form fields
  formNome = '';
  formTelefone = '';
  formEmail = '';
  formAniversario: Date | null = null;
  formObservacoes = '';
  formAvatar = '/girllandpage.png';

  clientes: Cliente[] = [];

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  async ngOnInit(): Promise<void> {
    if (this.isBrowser) {
      await this.carregarClientes();
    }
  }

  /**
   * Carregar clientes do Firestore
   */
  async carregarClientes(): Promise<void> {
    try {
      this.isLoading = true;
      const currentUser = this.authService.currentUser();
      
      if (!currentUser) {
        console.error('Usuário não autenticado');
        this.isLoading = false;
        return;
      }

      const clientesFirestore = await this.clienteService.listarClientesPorSalao(currentUser.uid);
      
      // Filtrar clientes válidos e converter para o formato do componente
      this.clientes = clientesFirestore
        .filter(c => {
          // Verificar se tem nome válido
          const temNome = c.nome && c.nome.trim() !== '';
          if (!temNome) {
            console.warn('Cliente sem nome encontrado, será ignorado:', c.id);
          }
          return temNome;
        })
        .map(c => this.converterCliente(c));
      
      console.log(`${this.clientes.length} clientes válidos carregados do Firestore`);
      this.isLoading = false;
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      this.isLoading = false;
    }
  }

  /**
   * Deletar cliente corrompido/sem dados
   */
  async deletarClienteCorreompido(clienteId: string): Promise<void> {
    try {
      // Por enquanto apenas inativa - depois pode implementar delete real
      await this.clienteService.atualizarCliente(clienteId, { status: 'inativo' });
      await this.carregarClientes();
    } catch (error) {
      console.error('Erro ao deletar cliente corrompido:', error);
    }
  }

  /**
   * Converter cliente do Firestore para formato do componente
   */
  private converterCliente(clienteFirestore: ClienteFirestore): Cliente {
    console.log('Convertendo cliente do Firestore:', clienteFirestore);
    
    // Converter Timestamp para Date
    let dataCadastro: Date;
    if (clienteFirestore.dataCadastro instanceof Timestamp) {
      dataCadastro = clienteFirestore.dataCadastro.toDate();
    } else if (clienteFirestore.dataCadastro) {
      dataCadastro = new Date(clienteFirestore.dataCadastro);
    } else {
      dataCadastro = new Date();
    }
    
    let ultimaVisita: Date | null = null;
    if (clienteFirestore.ultimaVisita) {
      if (clienteFirestore.ultimaVisita instanceof Timestamp) {
        ultimaVisita = clienteFirestore.ultimaVisita.toDate();
      } else {
        ultimaVisita = new Date(clienteFirestore.ultimaVisita);
      }
    }

    // Extrair serviços preferidos (os mais realizados)
    const servicosMap = new Map<string, number>();
    if (clienteFirestore.servicosRealizados && Array.isArray(clienteFirestore.servicosRealizados)) {
      clienteFirestore.servicosRealizados.forEach(s => {
        if (s && s.servicoNome) {
          servicosMap.set(s.servicoNome, (servicosMap.get(s.servicoNome) || 0) + 1);
        }
      });
    }
    
    const servicosPreferidos = Array.from(servicosMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([nome]) => nome);

    // Formatar telefone de forma segura
    const telefone = clienteFirestore.telefone 
      ? this.formatarTelefone(String(clienteFirestore.telefone))
      : '';

    const cliente: Cliente = {
      id: clienteFirestore.id || '',
      nome: clienteFirestore.nome || 'Sem nome',
      telefone: telefone,
      email: clienteFirestore.email || '',
      avatar: clienteFirestore.avatar || '/girllandpage.png',
      dataCadastro: dataCadastro,
      ultimaVisita: ultimaVisita,
      totalVisitas: clienteFirestore.totalVisitas || 0,
      totalGasto: clienteFirestore.totalGasto || 0,
      servicosPreferidos: servicosPreferidos,
      datasAgendamentos: clienteFirestore.datasAgendamentos || [],
      status: clienteFirestore.status || 'ativo',
      observacoes: clienteFirestore.observacoes || '',
      aniversario: clienteFirestore.aniversario || null
    };

    console.log('Cliente convertido:', cliente);
    return cliente;
  }

  /**
   * Formatar telefone para exibição
   */
  private formatarTelefone(telefone: string): string {
    // Remove caracteres não numéricos
    const nums = telefone.replace(/\D/g, '');
    
    // Formata (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
    if (nums.length === 11) {
      return `(${nums.substring(0, 2)}) ${nums.substring(2, 7)}-${nums.substring(7)}`;
    } else if (nums.length === 10) {
      return `(${nums.substring(0, 2)}) ${nums.substring(2, 6)}-${nums.substring(6)}`;
    }
    
    return telefone;
  }

  get filteredClientes(): Cliente[] {
    let filtered = this.clientes;

    // Aplicar filtro de status
    if (this.selectedFilter === 'ativos') {
      filtered = filtered.filter(c => c.status === 'ativo');
    } else if (this.selectedFilter === 'inativos') {
      filtered = filtered.filter(c => c.status === 'inativo');
    }

    // Aplicar busca
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(c => 
        c.nome.toLowerCase().includes(term) ||
        c.telefone.includes(term) ||
        (c.email && c.email.toLowerCase().includes(term))
      );
    }

    return filtered;
  }

  get clienteSummary(): ClienteSummary {
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

    return {
      total: this.clientes.length,
      ativos: this.clientes.filter(c => c.status === 'ativo').length,
      inativos: this.clientes.filter(c => c.status === 'inativo').length,
      novosEsteMes: this.clientes.filter(c => c.dataCadastro >= inicioMes).length
    };
  }

  get topClientes(): Cliente[] {
    return [...this.clientes]
      .sort((a, b) => b.totalGasto - a.totalGasto)
      .slice(0, 5);
  }

  get aniversariantesDoMes(): Cliente[] {
    const mesAtual = new Date().getMonth();
    return this.clientes
      .filter(c => c.aniversario && c.aniversario.getMonth() === mesAtual)
      .sort((a, b) => {
        if (!a.aniversario || !b.aniversario) return 0;
        return a.aniversario.getDate() - b.aniversario.getDate();
      });
  }

  setFilter(filter: string): void {
    this.selectedFilter = filter;
  }

  formatCurrency(value: number): string {
    return `R$ ${value.toFixed(2).replace('.', ',')}`;
  }

  formatDate(date: Date | null): string {
    if (!date) return '-';
    return date.toLocaleDateString('pt-BR');
  }

  formatBirthday(date: Date | null): string {
    if (!date) return '-';
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  getStatusClass(status: string): string {
    return status === 'ativo' ? 'status-ativo' : 'status-inativo';
  }

  getStatusLabel(status: string): string {
    return status === 'ativo' ? 'Ativo' : 'Inativo';
  }

  openNewClienteModal(): void {
    this.editingCliente = null;
    this.clearForm();
    this.showModal = true;
  }

  openEditClienteModal(cliente: Cliente): void {
    this.editingCliente = cliente;
    this.formNome = cliente.nome;
    this.formTelefone = cliente.telefone;
    this.formEmail = cliente.email || '';
    this.formAniversario = cliente.aniversario ? new Date(cliente.aniversario) : null;
    this.formObservacoes = cliente.observacoes || '';
    this.formAvatar = cliente.avatar || '/girllandpage.png';
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingCliente = null;
    this.clearForm();
  }

  clearForm(): void {
    this.formNome = '';
    this.formTelefone = '';
    this.formEmail = '';
    this.formAniversario = null;
    this.formObservacoes = '';
    this.formAvatar = '/girllandpage.png';
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      
      // Validar tipo de arquivo
      if (!file.type.startsWith('image/')) {
        alert('Por favor, selecione apenas arquivos de imagem.');
        return;
      }

      // Validar tamanho (máximo 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('A imagem deve ter no máximo 5MB.');
        return;
      }

      // Converter para base64 para preview
      const reader = new FileReader();
      reader.onload = (e) => {
        this.formAvatar = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  triggerFileInput(): void {
    if (this.isBrowser) {
      const fileInput = document.getElementById('avatarInput') as HTMLInputElement;
      if (fileInput) {
        fileInput.click();
      }
    }
  }

  removeAvatar(): void {
    this.formAvatar = '/girllandpage.png';
  }

  async saveCliente(): Promise<void> {
    if (!this.formNome.trim() || !this.formTelefone.trim()) {
      return;
    }

    const currentUser = this.authService.currentUser();
    if (!currentUser) {
      alert('Usuário não autenticado');
      return;
    }

    try {
      if (this.editingCliente) {
        // Atualizar cliente existente
        await this.clienteService.atualizarCliente(this.editingCliente.id, {
          nome: this.formNome,
          telefone: this.formTelefone,
          email: this.formEmail,
          avatar: this.formAvatar,
          aniversario: this.formAniversario,
          observacoes: this.formObservacoes
        });
        
        console.log('Cliente atualizado com sucesso');
      } else {
        // Criar novo cliente
        await this.clienteService.criarCliente({
          salonId: currentUser.uid,
          nome: this.formNome,
          telefone: this.formTelefone,
          email: this.formEmail,
          avatar: this.formAvatar,
          dataCadastro: new Date(),
          ultimaVisita: null,
          totalVisitas: 0,
          totalGasto: 0,
          servicosRealizados: [],
          datasAgendamentos: [],
          status: 'ativo',
          observacoes: this.formObservacoes,
          aniversario: this.formAniversario
        });
        
        console.log('Cliente criado com sucesso');
      }

      // Recarregar lista de clientes
      await this.carregarClientes();
      this.closeModal();
    } catch (error) {
      console.error('Erro ao salvar cliente:', error);
      alert('Erro ao salvar cliente. Tente novamente.');
    }
  }

  async toggleClienteStatus(cliente: Cliente): Promise<void> {
    try {
      const novoStatus = cliente.status === 'ativo' ? 'inativo' : 'ativo';
      await this.clienteService.atualizarCliente(cliente.id, {
        status: novoStatus
      });
      
      // Atualizar localmente
      const index = this.clientes.findIndex(c => c.id === cliente.id);
      if (index !== -1) {
        this.clientes[index].status = novoStatus;
      }
      
      console.log('Status do cliente atualizado');
    } catch (error) {
      console.error('Erro ao atualizar status do cliente:', error);
      alert('Erro ao atualizar status. Tente novamente.');
    }
  }

  deleteCliente(cliente: Cliente): void {
    this.clienteParaExcluir = cliente;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.clienteParaExcluir = null;
  }

  async confirmDeleteCliente(): Promise<void> {
    if (!this.clienteParaExcluir) {
      return;
    }

    try {
      await this.clienteService.deletarClienteHard(this.clienteParaExcluir.id);
      this.clientes = this.clientes.filter(c => c.id !== this.clienteParaExcluir?.id);
      this.closeDeleteModal();
      console.log('Cliente deletado definitivamente');
    } catch (error) {
      console.error('Erro ao deletar cliente:', error);
      alert('Erro ao deletar cliente. Tente novamente.');
    }
  }

  sendWhatsApp(cliente: Cliente): void {
    const phone = cliente.telefone.replace(/\D/g, '');
    const message = encodeURIComponent(`Olá ${cliente.nome}! Tudo bem?`);
    window.open(`https://wa.me/55${phone}?text=${message}`, '_blank');
  }
}
