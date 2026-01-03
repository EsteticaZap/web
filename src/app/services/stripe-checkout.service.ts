import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

interface CheckoutSessionResponse {
  sessionId: string;
}

interface RetrievedSession {
  id: string;
  status: string;
  payment_status: string;
  customer_email?: string;
}

@Injectable({
  providedIn: 'root'
})
export class StripeCheckoutService {
  private stripeLoader: Promise<StripeInstance | null> | null = null;

  private async loadStripe(): Promise<StripeInstance> {
    if (typeof window === 'undefined') {
      throw new Error('O Stripe só pode ser carregado no navegador.');
    }

    if (!environment.stripe?.publishableKey) {
      throw new Error('Chave pública do Stripe não configurada.');
    }

    if (window.Stripe) {
      const instance = window.Stripe(environment.stripe.publishableKey);
      if (!instance) {
        throw new Error('Não foi possível inicializar o Stripe.');
      }
      return instance;
    }

    if (!this.stripeLoader) {
      this.stripeLoader = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://js.stripe.com/v3';
        script.async = true;
        script.onload = () => {
          if (window.Stripe) {
            resolve(window.Stripe(environment.stripe.publishableKey)!);
          } else {
            reject(new Error('Stripe não carregado'));
          }
        };
        script.onerror = () => reject(new Error('Erro ao carregar biblioteca de pagamentos.'));
        document.body.appendChild(script);
      });
    }

    const stripe = await this.stripeLoader;
    if (!stripe) {
      throw new Error('Não foi possível iniciar o Stripe.');
    }
    return stripe;
  }

  private buildSuccessUrl(): string {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/planos?session_id={CHECKOUT_SESSION_ID}`;
  }

  private buildCancelUrl(): string {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/planos?cancelado=1`;
  }

  async criarSessaoCheckout(customerEmail?: string): Promise<CheckoutSessionResponse> {
    if (typeof window === 'undefined') {
      throw new Error('O checkout só pode ser iniciado no navegador.');
    }

    if (!environment.stripe?.priceId) {
      throw new Error('Preço do Stripe não configurado.');
    }

    const successUrl = this.buildSuccessUrl();
    const cancelUrl = this.buildCancelUrl();

    if (!successUrl || !cancelUrl) {
      throw new Error('URLs de retorno do Stripe não puderam ser definidas.');
    }

    const response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        priceId: environment.stripe.priceId,
        successUrl,
        cancelUrl,
        customerEmail
      })
    });

    const data = await response.json();
    if (!response.ok || !data.sessionId) {
      throw new Error(data.error || 'Não foi possível criar a sessão de pagamento.');
    }

    return data as CheckoutSessionResponse;
  }

  async redirecionarParaCheckout(sessionId: string): Promise<void> {
    const stripe = await this.loadStripe();
    const { error } = await stripe.redirectToCheckout({ sessionId });
    if (error?.message) {
      throw new Error(error.message);
    }
  }

  async buscarSessao(sessionId: string): Promise<RetrievedSession> {
    const response = await fetch(`/api/checkout-session/${sessionId}`);
    const data = await response.json();

    if (!response.ok || !data.id) {
      throw new Error(data.error || 'Não foi possível recuperar o status do pagamento.');
    }

    return data as RetrievedSession;
  }
}
