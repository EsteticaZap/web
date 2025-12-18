import { Injectable, inject, signal, effect } from '@angular/core';
import { Firestore, doc, getDoc, collection, query, where, getDocs, setDoc, serverTimestamp } from '@angular/fire/firestore';
import { AuthService } from './auth.service';

export interface Assinatura {
  uid: string;
  plano: 'free' | 'pro';
  status: 'ativo' | 'cancelado' | 'expirado';
  dataInicio: any;
  dataFim?: any;
  valorMensal?: number;
  metodoPagamento?: string;
  createdAt: any;
  updatedAt: any;
}

export interface PlanoDetalhes {
  nome: string;
  preco: number;
  periodo: string;
  vantagens: string[];
  limitacoes?: string[];
  destaque?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AssinaturaService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);

  // Signal para gerenciar estado da assinatura
  assinaturaAtual = signal<Assinatura | null>(null);
  isLoading = signal<boolean>(false);

  constructor() {
    // Carregar assinatura quando o usuário estiver autenticado
    effect(() => {
      const user = this.authService.currentUser();
      if (user) {
        this.carregarAssinatura(user.uid);
      } else {
        this.assinaturaAtual.set(null);
      }
    });
  }

  /**
   * Carregar assinatura do usuário do Firestore
   */
  async carregarAssinatura(uid: string): Promise<void> {
    this.isLoading.set(true);
    try {
      const assinaturaRef = doc(this.firestore, 'assinaturas', uid);
      const assinaturaSnap = await getDoc(assinaturaRef);

      if (assinaturaSnap.exists()) {
        this.assinaturaAtual.set(assinaturaSnap.data() as Assinatura);
      } else {
        // Se não existe assinatura, assume plano Free sem criar documento
        this.assinaturaAtual.set({
          uid: uid,
          plano: 'free',
          status: 'ativo',
          dataInicio: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    } catch (error) {
      console.error('Erro ao carregar assinatura:', error);
      // Em caso de erro, assume plano free
      this.assinaturaAtual.set({
        uid: uid,
        plano: 'free',
        status: 'ativo',
        dataInicio: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      });
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Verificar se o usuário tem plano pro
   */
  isPlanoProAtivo(): boolean {
    const assinatura = this.assinaturaAtual();
    return assinatura?.plano === 'pro' && assinatura?.status === 'ativo';
  }

  /**
   * Verificar se o usuário tem plano free
   */
  isPlanoFree(): boolean {
    const assinatura = this.assinaturaAtual();
    return !assinatura || assinatura?.plano === 'free';
  }

  /**
   * Obter detalhes dos planos disponíveis
   */
  getPlanos(): PlanoDetalhes[] {
    return [
      {
        nome: 'Free',
        preco: 0,
        periodo: 'Gratuito',
        vantagens: [
          'Até 50 agendamentos por mês',
          'Cadastro de até 100 clientes',
          'Agenda básica (visualização diária)',
          '1 usuário',
          'Suporte por email',
          'Relatórios básicos'
        ],
        limitacoes: [
          'Sem integração com WhatsApp',
          'Sem lembretes automáticos',
          'Sem exportação de dados',
          'Sem múltiplos profissionais'
        ]
      },
      {
        nome: 'Pro',
        preco: 49.90,
        periodo: 'por mês',
        vantagens: [
          'Agendamentos ilimitados',
          'Clientes ilimitados',
          'Agenda completa (diária, semanal e mensal)',
          'Até 5 usuários/profissionais',
          'Integração com WhatsApp',
          'Lembretes automáticos por SMS e email',
          'Relatórios avançados e gráficos',
          'Exportação de dados (Excel/PDF)',
          'Suporte prioritário via WhatsApp',
          'Personalização completa',
          'Sistema de comissões',
          'Controle de estoque (produtos)',
          'Link de agendamento personalizado',
          'Sem anúncios'
        ],
        destaque: true
      }
    ];
  }

  /**
   * Atualizar assinatura para plano pro
   */
  async atualizarParaPro(metodoPagamento: string): Promise<{ success: boolean; error?: string }> {
    try {
      const user = this.authService.currentUser();
      if (!user) {
        return { success: false, error: 'Usuário não autenticado' };
      }

      const assinaturaRef = doc(this.firestore, 'assinaturas', user.uid);

      const assinaturaPro: Assinatura = {
        uid: user.uid,
        plano: 'pro',
        status: 'ativo',
        dataInicio: serverTimestamp(),
        valorMensal: 49.90,
        metodoPagamento: metodoPagamento,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await setDoc(assinaturaRef, assinaturaPro);
      this.assinaturaAtual.set(assinaturaPro);

      return { success: true };
    } catch (error) {
      console.error('Erro ao atualizar assinatura:', error);
      return { success: false, error: 'Erro ao processar assinatura. Tente novamente.' };
    }
  }

  /**
   * Cancelar assinatura pro
   */
  async cancelarAssinatura(): Promise<{ success: boolean; error?: string }> {
    try {
      const user = this.authService.currentUser();
      if (!user) {
        return { success: false, error: 'Usuário não autenticado' };
      }

      const assinaturaRef = doc(this.firestore, 'assinaturas', user.uid);
      const assinaturaAtual = this.assinaturaAtual();

      if (!assinaturaAtual) {
        return { success: false, error: 'Assinatura não encontrada' };
      }

      const assinaturaCancelada: Assinatura = {
        ...assinaturaAtual,
        status: 'cancelado',
        dataFim: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await setDoc(assinaturaRef, assinaturaCancelada);
      this.assinaturaAtual.set(assinaturaCancelada);

      return { success: true };
    } catch (error) {
      console.error('Erro ao cancelar assinatura:', error);
      return { success: false, error: 'Erro ao cancelar assinatura. Tente novamente.' };
    }
  }
}
