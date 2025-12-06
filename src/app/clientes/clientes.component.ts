import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SideMenuComponent } from '../side-menu/side-menu.component';
import { DatePickerModule } from 'primeng/datepicker';

interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  avatar: string;
  dataCadastro: Date;
  ultimaVisita: Date | null;
  totalVisitas: number;
  totalGasto: number;
  servicosPreferidos: string[];
  status: 'ativo' | 'inativo';
  observacoes: string;
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
  imports: [CommonModule, SideMenuComponent, FormsModule, DatePickerModule],
  templateUrl: './clientes.component.html',
  styleUrls: ['./clientes.component.css']
})
export class ClientesComponent {
  isBrowser: boolean;
  searchTerm = '';
  selectedFilter = 'todos';
  showModal = false;
  editingCliente: Cliente | null = null;
  
  // Form fields
  formNome = '';
  formTelefone = '';
  formEmail = '';
  formAniversario: Date | null = null;
  formObservacoes = '';
  formAvatar = '/girllandpage.png';

  clientes: Cliente[] = [
    {
      id: '1',
      nome: 'Juliana Santos',
      telefone: '(11) 99999-1234',
      email: 'juliana.santos@email.com',
      avatar: '/girllandpage.png',
      dataCadastro: new Date(2024, 2, 15),
      ultimaVisita: new Date(2024, 10, 18),
      totalVisitas: 12,
      totalGasto: 1250.00,
      servicosPreferidos: ['Manicure', 'Pedicure', 'Hidratação'],
      status: 'ativo',
      observacoes: 'Prefere horários pela manhã',
      aniversario: new Date(1992, 5, 20)
    },
    {
      id: '2',
      nome: 'Roberto Silva',
      telefone: '(11) 98888-5678',
      email: 'roberto.silva@email.com',
      avatar: '/girllandpage.png',
      dataCadastro: new Date(2024, 4, 10),
      ultimaVisita: new Date(2024, 10, 15),
      totalVisitas: 8,
      totalGasto: 560.00,
      servicosPreferidos: ['Corte Masculino', 'Barba'],
      status: 'ativo',
      observacoes: '',
      aniversario: new Date(1988, 8, 12)
    },
    {
      id: '3',
      nome: 'Beatriz Lima',
      telefone: '(11) 97777-9012',
      email: 'beatriz.lima@email.com',
      avatar: '/girllandpage.png',
      dataCadastro: new Date(2024, 0, 5),
      ultimaVisita: new Date(2024, 10, 21),
      totalVisitas: 24,
      totalGasto: 3200.00,
      servicosPreferidos: ['Hidratação Capilar', 'Coloração', 'Escova'],
      status: 'ativo',
      observacoes: 'Cliente VIP - sempre oferecer café',
      aniversario: new Date(1985, 11, 3)
    },
    {
      id: '4',
      nome: 'Fernanda Costa',
      telefone: '(11) 96666-3456',
      email: 'fernanda.costa@email.com',
      avatar: '/girllandpage.png',
      dataCadastro: new Date(2024, 6, 20),
      ultimaVisita: new Date(2024, 10, 10),
      totalVisitas: 5,
      totalGasto: 890.00,
      servicosPreferidos: ['Progressiva', 'Corte'],
      status: 'ativo',
      observacoes: 'Alergia a alguns produtos químicos - verificar antes',
      aniversario: new Date(1995, 2, 28)
    },
    {
      id: '5',
      nome: 'Mariana Silva',
      telefone: '(11) 95555-7890',
      email: 'mariana.silva@email.com',
      avatar: '/girllandpage.png',
      dataCadastro: new Date(2024, 1, 12),
      ultimaVisita: new Date(2024, 10, 19),
      totalVisitas: 15,
      totalGasto: 2100.00,
      servicosPreferidos: ['Corte', 'Coloração', 'Mechas'],
      status: 'ativo',
      observacoes: '',
      aniversario: new Date(1990, 7, 15)
    },
    {
      id: '6',
      nome: 'Carlos Mendes',
      telefone: '(11) 94444-1234',
      email: 'carlos.mendes@email.com',
      avatar: '/girllandpage.png',
      dataCadastro: new Date(2024, 8, 1),
      ultimaVisita: new Date(2024, 9, 5),
      totalVisitas: 3,
      totalGasto: 175.00,
      servicosPreferidos: ['Corte Masculino'],
      status: 'inativo',
      observacoes: 'Não compareceu nas últimas 2 vezes',
      aniversario: null
    },
    {
      id: '7',
      nome: 'Patricia Oliveira',
      telefone: '(11) 93333-5678',
      email: 'patricia.oliveira@email.com',
      avatar: '/girllandpage.png',
      dataCadastro: new Date(2024, 3, 8),
      ultimaVisita: new Date(2024, 10, 20),
      totalVisitas: 10,
      totalGasto: 1450.00,
      servicosPreferidos: ['Escova Progressiva', 'Manicure'],
      status: 'ativo',
      observacoes: '',
      aniversario: new Date(1987, 0, 22)
    },
    {
      id: '8',
      nome: 'Camila Rocha',
      telefone: '(11) 92222-9012',
      email: 'camila.rocha@email.com',
      avatar: '/girllandpage.png',
      dataCadastro: new Date(2024, 5, 15),
      ultimaVisita: new Date(2024, 10, 12),
      totalVisitas: 7,
      totalGasto: 980.00,
      servicosPreferidos: ['Coloração', 'Corte'],
      status: 'ativo',
      observacoes: 'Prefere atendimento com a Ana',
      aniversario: new Date(1993, 4, 10)
    },
    {
      id: '9',
      nome: 'Carla Mendes',
      telefone: '(11) 91111-3456',
      email: 'carla.mendes@email.com',
      avatar: '/girllandpage.png',
      dataCadastro: new Date(2024, 7, 25),
      ultimaVisita: new Date(2024, 10, 8),
      totalVisitas: 4,
      totalGasto: 320.00,
      servicosPreferidos: ['Design de Sobrancelhas', 'Manicure'],
      status: 'ativo',
      observacoes: '',
      aniversario: new Date(1998, 9, 5)
    },
    {
      id: '10',
      nome: 'Ana Paula Costa',
      telefone: '(11) 90000-7890',
      email: 'ana.paula@email.com',
      avatar: '/girllandpage.png',
      dataCadastro: new Date(2024, 9, 3),
      ultimaVisita: null,
      totalVisitas: 0,
      totalGasto: 0,
      servicosPreferidos: [],
      status: 'inativo',
      observacoes: 'Cadastro realizado mas nunca agendou',
      aniversario: new Date(1991, 6, 18)
    }
  ];

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
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
        c.email.toLowerCase().includes(term)
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
    this.formEmail = cliente.email;
    this.formAniversario = cliente.aniversario ? new Date(cliente.aniversario) : null;
    this.formObservacoes = cliente.observacoes;
    this.formAvatar = cliente.avatar;
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

  saveCliente(): void {
    if (!this.formNome.trim() || !this.formTelefone.trim()) {
      return;
    }

    if (this.editingCliente) {
      // Atualizar cliente existente
      const index = this.clientes.findIndex(c => c.id === this.editingCliente!.id);
      if (index !== -1) {
        this.clientes[index] = {
          ...this.clientes[index],
          nome: this.formNome,
          telefone: this.formTelefone,
          email: this.formEmail,
          avatar: this.formAvatar,
          aniversario: this.formAniversario ? new Date(this.formAniversario) : null,
          observacoes: this.formObservacoes
        };
      }
    } else {
      // Criar novo cliente
      const newCliente: Cliente = {
        id: (this.clientes.length + 1).toString(),
        nome: this.formNome,
        telefone: this.formTelefone,
        email: this.formEmail,
        avatar: this.formAvatar,
        dataCadastro: new Date(),
        ultimaVisita: null,
        totalVisitas: 0,
        totalGasto: 0,
        servicosPreferidos: [],
        status: 'ativo',
        observacoes: this.formObservacoes,
        aniversario: this.formAniversario ? new Date(this.formAniversario) : null
      };
      this.clientes.push(newCliente);
    }

    this.closeModal();
  }

  toggleClienteStatus(cliente: Cliente): void {
    const index = this.clientes.findIndex(c => c.id === cliente.id);
    if (index !== -1) {
      this.clientes[index].status = cliente.status === 'ativo' ? 'inativo' : 'ativo';
    }
  }

  deleteCliente(cliente: Cliente): void {
    if (confirm(`Tem certeza que deseja excluir o cliente ${cliente.nome}?`)) {
      this.clientes = this.clientes.filter(c => c.id !== cliente.id);
    }
  }

  sendWhatsApp(cliente: Cliente): void {
    const phone = cliente.telefone.replace(/\D/g, '');
    const message = encodeURIComponent(`Olá ${cliente.nome}! Tudo bem?`);
    window.open(`https://wa.me/55${phone}?text=${message}`, '_blank');
  }
}
