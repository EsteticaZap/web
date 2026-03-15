import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

interface CheckoutSessionResponse {
  sessionId?: string;
  checkoutUrl?: string;
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
  private authService = inject(AuthService);
  private stripeLoader: Promise<StripeInstance | null> | null = null;

  private async safeParseJson(response: Response): Promise<{ data: any; rawText: string }> {
    const text = await response.text();
    if (!text.trim()) {
      return { data: null, rawText: '' };
    }

    try {
      return { data: JSON.parse(text), rawText: text };
    } catch {
      return { data: null, rawText: text };
    }
  }

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

  async criarSessaoCheckout(salonId: string, customerEmail?: string): Promise<CheckoutSessionResponse> {
    if (typeof window === 'undefined') {
      throw new Error('O checkout só pode ser iniciado no navegador.');
    }

    if (!salonId) {
      throw new Error('Identificador do salão não encontrado.');
    }

    const authorization = await this.authService.getAuthorizationHeader();
    const response = await fetch('https://esteticazap-webhook.onrender.com/stripe/checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authorization ? { Authorization: authorization } : {})
      },
      body: JSON.stringify({
        salonId,
        customerEmail
      })
    });

    const { data, rawText } = await this.safeParseJson(response);
    const checkoutUrl = data?.url ?? data?.checkoutUrl;
    const sessionId = data?.sessionId;

    if (response.ok) {
      if (checkoutUrl) {
        return { checkoutUrl };
      }

      if (sessionId) {
        return { sessionId };
      }

      if (rawText && /^https?:\/\//i.test(rawText.trim())) {
        return { checkoutUrl: rawText.trim() };
      }
    }

    const mensagemErro =
      data?.error ||
      (rawText ? 'Resposta do servidor não pôde ser interpretada.' : 'Resposta do servidor vazia.') ||
      'Não foi possível criar a sessão de pagamento. Por favor, tente novamente.';
    throw new Error(mensagemErro);
  }

  async redirecionarParaCheckout(sessionId: string): Promise<void> {
    const stripe = await this.loadStripe();
    const { error } = await stripe.redirectToCheckout({ sessionId });
    if (error?.message) {
      throw new Error(error.message);
    }
  }

  redirecionarParaCheckoutUrl(checkoutUrl: string): void {
    if (typeof window === 'undefined') {
      throw new Error('O checkout só pode ser iniciado no navegador.');
    }
    window.location.href = checkoutUrl;
  }

  async buscarSessao(sessionId: string): Promise<RetrievedSession> {
    const response = await fetch(`/api/checkout-session/${sessionId}`);
    const { data, rawText } = await this.safeParseJson(response);

    if (!response.ok || !data?.id) {
      const mensagemErro =
        data?.error ||
        (rawText ? 'Resposta do servidor não pôde ser interpretada.' : 'Resposta do servidor vazia.') ||
        'Não foi possível recuperar o status do pagamento. Por favor, tente novamente.';
      throw new Error(mensagemErro);
    }

    return data as RetrievedSession;
  }
}
