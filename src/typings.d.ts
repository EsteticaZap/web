declare module '@fortawesome/angular-fontawesome';
declare module '@fortawesome/fontawesome-svg-core';
declare module '@fortawesome/free-solid-svg-icons';

interface StripeRedirectResult {
  error?: {
    message?: string;
  };
}

interface StripeInstance {
  redirectToCheckout: (options: { sessionId: string }) => Promise<StripeRedirectResult>;
}

interface Window {
  Stripe?: (publishableKey: string) => StripeInstance;
}
