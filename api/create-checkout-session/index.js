const STRIPE_API_BASE = 'https://api.stripe.com/v1';

async function parseJsonResponse(response) {
  const text = await response.text();
  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error('Resposta inválida do Stripe.');
  }
}

async function createStripeCheckoutSession(body, secretKey) {
  const response = await fetch(`${STRIPE_API_BASE}/checkout/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data?.error?.message || 'Erro ao criar sessão de pagamento.');
  }

  return data;
}

function parseRequestBody(req) {
  if (req?.body && typeof req.body === 'object') {
    return req.body;
  }

  const rawBody = typeof req?.body === 'string' ? req.body : req?.rawBody;
  if (!rawBody || typeof rawBody !== 'string') {
    return {};
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    return {};
  }
}

module.exports = async function (context, req) {
  try {
    if (req.method === 'OPTIONS') {
      context.res = {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      };
      return;
    }

    const stripeSecretKey = process.env['STRIPE_SECRET_KEY'];
    const defaultPriceId = process.env['STRIPE_PRICE_ID'];

    if (!stripeSecretKey) {
      context.log.error('Stripe secret key não configurada (STRIPE_SECRET_KEY).');
      return (context.res = {
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: { error: 'Stripe secret key não configurada.' },
      });
    }

    const body = parseRequestBody(req);
    const priceId = body?.priceId || defaultPriceId;
    const successUrl = body?.successUrl;
    const cancelUrl = body?.cancelUrl;
    const customerEmail = body?.customerEmail;

    if (!priceId || !successUrl || !cancelUrl) {
      return (context.res = {
        status: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: { error: 'Dados insuficientes para criar a sessão de checkout.' },
      });
    }

    const formBody = new URLSearchParams({
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
    });

    if (customerEmail) {
      formBody.append('customer_email', customerEmail);
    }

    const session = await createStripeCheckoutSession(formBody, stripeSecretKey);

    context.res = {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: { sessionId: session.id },
    };
  } catch (error) {
    context.log.error('Erro ao criar sessão de checkout:', error);
    context.res = {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: { error: error?.message || 'Erro ao criar sessão de pagamento.' },
    };
  }
};
