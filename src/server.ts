import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Request, Response } from 'express';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();
app.use(express.json());

const stripeSecretKey = process.env['STRIPE_SECRET_KEY'];
const defaultPriceId = process.env['STRIPE_PRICE_ID'];

async function createStripeCheckoutSession(
  priceId: string,
  successUrl: string,
  cancelUrl: string,
  customerEmail?: string,
): Promise<{ id: string }> {
  if (!stripeSecretKey) {
    throw new Error('Stripe secret key não configurada (STRIPE_SECRET_KEY).');
  }

  const body = new URLSearchParams({
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
  });

  if (customerEmail) {
    body.append('customer_email', customerEmail);
  }

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || 'Erro ao criar sessão de pagamento.');
  }

  return { id: data.id };
}

async function retrieveStripeSession(sessionId: string): Promise<any> {
  if (!stripeSecretKey) {
    throw new Error('Stripe secret key não configurada (STRIPE_SECRET_KEY).');
  }

  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || 'Erro ao recuperar sessão do Stripe.');
  }

  return data;
}

app.post('/api/create-checkout-session', async (req: Request, res: Response) => {
  try {
    const priceId = (req.body?.priceId as string | undefined) || defaultPriceId;
    const successUrl = req.body?.successUrl as string | undefined;
    const cancelUrl = req.body?.cancelUrl as string | undefined;
    const customerEmail = req.body?.customerEmail as string | undefined;

    if (!priceId || !successUrl || !cancelUrl) {
      return res.status(400).json({ error: 'Dados insuficientes para criar a sessão de checkout.' });
    }

    const session = await createStripeCheckoutSession(priceId, successUrl, cancelUrl, customerEmail);
    return res.json({ sessionId: session.id });
  } catch (error) {
    console.error('Erro ao criar sessão de checkout:', error);
    return res.status(500).json({ error: (error as Error).message || 'Erro ao criar sessão de pagamento.' });
  }
});

app.get('/api/checkout-session/:id', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params['id'];
    if (!sessionId) {
      return res.status(400).json({ error: 'Sessão inválida.' });
    }

    const session = await retrieveStripeSession(sessionId);
    return res.json({
      id: session.id,
      status: session.status,
      payment_status: session.payment_status,
      customer_email: session.customer_email || session?.customer_details?.email,
    });
  } catch (error) {
    console.error('Erro ao buscar sessão de checkout:', error);
    return res.status(500).json({ error: (error as Error).message || 'Erro ao buscar sessão de pagamento.' });
  }
});

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/**', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use('/**', (req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
