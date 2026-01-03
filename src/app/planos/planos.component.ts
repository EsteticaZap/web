import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PricingCardComponent } from '../shared/pricing-card/pricing-card.component';
import { AssinaturaService, PlanoDetalhes } from '../services/assinatura.service';
import { AuthService } from '../services/auth.service';
import { StripeCheckoutService } from '../services/stripe-checkout.service';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-planos',
  standalone: true,
  imports: [CommonModule, PricingCardComponent],
  templateUrl: './planos.component.html',
  styleUrl: './planos.component.css'
})
export class PlanosComponent implements OnInit {
  assinaturaService = inject(AssinaturaService);
  authService = inject(AuthService);
  stripeCheckoutService = inject(StripeCheckoutService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  planos: PlanoDetalhes[] = [];
  mostrarModalPagamento: boolean = false;
  isLoadingPagamento: boolean = false;
  verificandoSessaoPagamento: boolean = false;
  mensagemErro?: string;
  mensagemSucesso?: string;
  erroModalPagamento?: string;
  isBrowser = typeof window !== 'undefined';

  ngOnInit(): void {
    this.planos = this.assinaturaService.getPlanos();
    this.processarRetornoCheckout();
  }

  isPlanoAtual(nomePlano: string): boolean {
    const assinatura = this.assinaturaService.assinaturaAtual();
    if (!assinatura) return nomePlano.toLowerCase() === 'free';
    return assinatura.plano === nomePlano.toLowerCase();
  }

  async selecionarPlano(plano: PlanoDetalhes): Promise<void> {
    this.mensagemErro = undefined;
    this.mensagemSucesso = undefined;

    // Se for o plano free e já estiver no free, não faz nada
    if (plano.nome.toLowerCase() === 'free' && this.isPlanoAtual('free')) {
      return;
    }

    // Se for o plano pro e já estiver no pro, não faz nada
    if (plano.nome.toLowerCase() === 'pro' && this.isPlanoAtual('pro')) {
      return;
    }

    // Se for o plano pro e estiver no free, mostrar modal de pagamento
    if (plano.nome.toLowerCase() === 'pro') {
      this.mostrarModalPagamento = true;
    }
  }

  fecharModalPagamento(): void {
    this.mostrarModalPagamento = false;
    this.erroModalPagamento = undefined;
  }

  async confirmarPagamento(): Promise<void> {
    this.erroModalPagamento = undefined;
    this.isLoadingPagamento = true;

    try {
      const userEmail = this.authService.currentUser()?.email || undefined;
      const { sessionId } = await this.stripeCheckoutService.criarSessaoCheckout(userEmail);
      await this.stripeCheckoutService.redirecionarParaCheckout(sessionId);
    } catch (error) {
      console.error('Erro ao confirmar pagamento:', error);
      this.erroModalPagamento = (error as Error).message || 'Erro ao processar pagamento. Tente novamente.';
    } finally {
      this.isLoadingPagamento = false;
    }
  }

  getStatusBadgeClass(): string {
    const assinatura = this.assinaturaService.assinaturaAtual();
    if (assinatura?.plano === 'pro') {
      return 'badge-pro';
    }
    return 'badge-free';
  }

  getStatusBadgeText(): string {
    const assinatura = this.assinaturaService.assinaturaAtual();
    if (assinatura?.plano === 'pro') {
      return 'Plano Pro Ativo';
    }
    return 'Plano Free';
  }

  private async processarRetornoCheckout(): Promise<void> {
    if (!this.isBrowser) {
      return;
    }

    const params = await firstValueFrom(this.route.queryParamMap);
    const sessionId = params.get('session_id');
    const cancelado = params.get('cancelado');

    if (!sessionId && !cancelado) {
      return;
    }

    const limparParametros = () => {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {},
        replaceUrl: true
      });
    };

    if (cancelado) {
      this.mensagemErro = 'Pagamento cancelado. Nenhuma cobrança foi realizada.';
      limparParametros();
      return;
    }

    if (sessionId) {
      this.verificandoSessaoPagamento = true;
      try {
        const sessao = await this.stripeCheckoutService.buscarSessao(sessionId);
        if (sessao.payment_status === 'paid' || sessao.status === 'complete') {
          const resultado = await this.assinaturaService.atualizarParaPro('stripe-checkout', sessionId);
          if (resultado.success) {
            this.mensagemSucesso = 'Pagamento confirmado! Seu plano Pro já está ativo.';
            this.mostrarModalPagamento = false;
          } else {
            this.mensagemErro = resultado.error || 'Pagamento confirmado, mas não foi possível atualizar sua assinatura.';
          }
        } else {
          this.mensagemErro = 'Pagamento não concluído. Status atual: ' + sessao.payment_status;
        }
      } catch (error) {
        console.error('Erro ao validar sessão do Stripe:', error);
        this.mensagemErro = 'Não foi possível validar o pagamento. Tente novamente.';
      } finally {
        this.verificandoSessaoPagamento = false;
        limparParametros();
      }
    }
  }
}
