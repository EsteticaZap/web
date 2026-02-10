import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Firestore, doc, getDoc, updateDoc } from '@angular/fire/firestore';

interface AgendamentoDetalhe {
  salonId: string;
  profissionalNome?: string;
  clienteNome: string;
  clienteTelefone?: string;
  servicos: { id: string; nome: string; valor: number; duracao: number }[];
  data: string;
  horaInicio: string;
  horaFim: string;
  status: 'pendente' | 'confirmado' | 'cancelado';
  valorTotal: number;
}

interface SalaoPublico {
  displayName?: string;
  fotoSalao?: string;
  configuracoes?: {
    nomeSalao?: string;
    endereco?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
  };
}

@Component({
  selector: 'app-atendimento-publico',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './atendimento-publico.component.html',
  styleUrls: ['./atendimento-publico.component.css']
})
export class AtendimentoPublicoComponent implements OnInit {
  private firestore = inject(Firestore);
  private route = inject(ActivatedRoute);

  agendamentoId = '';
  agendamento: AgendamentoDetalhe | null = null;
  salao: SalaoPublico | null = null;
  isLoading = true;
  isProcessing = false;
  errorMessage = '';
  successMessage = '';

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.agendamentoId = params['agendamentoId'];
      if (!this.agendamentoId) {
        this.errorMessage = 'ID do agendamento não informado.';
        this.isLoading = false;
        return;
      }

      this.carregarAgendamento();
    });
  }

  get statusLabel(): string {
    if (!this.agendamento) return '';

    const labels: Record<AgendamentoDetalhe['status'], string> = {
      pendente: 'Pendente de confirmação',
      confirmado: 'Confirmado',
      cancelado: 'Cancelado'
    };

    return labels[this.agendamento.status];
  }

  get statusClass(): string {
    if (!this.agendamento) return '';

    return `status-${this.agendamento.status}`;
  }

  async carregarAgendamento(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      const agendamentoRef = doc(this.firestore, 'agendamentos', this.agendamentoId);
      const snapshot = await getDoc(agendamentoRef);

      if (!snapshot.exists()) {
        this.errorMessage = 'Agendamento não encontrado.';
        this.isLoading = false;
        return;
      }

      this.agendamento = snapshot.data() as AgendamentoDetalhe;
      if (this.agendamento?.salonId) {
        await this.carregarSalao(this.agendamento.salonId);
      }
    } catch (error) {
      console.error('Erro ao carregar agendamento:', error);
      this.errorMessage = 'Não foi possível carregar o agendamento. Tente novamente.';
    } finally {
      this.isLoading = false;
    }
  }

  private async carregarSalao(salonId: string): Promise<void> {
    try {
      const salaoRef = doc(this.firestore, 'users', salonId);
      const snapshot = await getDoc(salaoRef);

      if (snapshot.exists()) {
        this.salao = snapshot.data() as SalaoPublico;
      }
    } catch (error) {
      console.error('Erro ao carregar dados do salão:', error);
    }
  }

  async confirmarAgendamento(): Promise<void> {
    if (!this.agendamento || this.agendamento.status !== 'pendente') {
      return;
    }

    await this.atualizarStatus('confirmar', 'confirmado');
  }

  async cancelarAgendamento(): Promise<void> {
    if (!this.agendamento || this.agendamento.status === 'cancelado') {
      return;
    }

    await this.atualizarStatus('cancelar', 'cancelado');
  }

  private async atualizarStatus(acao: 'confirmar' | 'cancelar', novoStatus: AgendamentoDetalhe['status']): Promise<void> {
    this.isProcessing = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const response = await fetch(`https://esteticazap-webhook.onrender.com/agenda/${this.agendamentoId}/${acao}`, {
        method: 'POST',
        headers: {
          accept: 'application/json'
        }
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Erro ao atualizar agendamento.');
      }

      const agendamentoRef = doc(this.firestore, 'agendamentos', this.agendamentoId);
      await updateDoc(agendamentoRef, { status: novoStatus });

      if (this.agendamento) {
        this.agendamento = {
          ...this.agendamento,
          status: novoStatus
        };
      }

      this.successMessage = novoStatus === 'confirmado'
        ? 'Agendamento confirmado com sucesso!'
        : 'Agendamento cancelado com sucesso.';
    } catch (error) {
      console.error('Erro ao atualizar status do agendamento:', error);
      this.errorMessage = 'Não foi possível atualizar o agendamento. Tente novamente.';
    } finally {
      this.isProcessing = false;
    }
  }
}
