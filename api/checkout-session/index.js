const STRIPE_API_BASE = 'https://api.stripe.com/v1';

async function retrieveStripeSession(sessionId, secretKey) {
  const response = await fetch(`${STRIPE_API_BASE}/checkout/sessions/${sessionId}`, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || 'Erro ao recuperar sessão do Stripe.');
  }

  return data;
}

module.exports = async function (context, req) {
  try {
    const stripeSecretKey = process.env['STRIPE_SECRET_KEY'];
    if (!stripeSecretKey) {
      context.log.error('Stripe secret key não configurada (STRIPE_SECRET_KEY).');
      return (context.res = {
        status: 500,
        body: { error: 'Stripe secret key não configurada.' },
      });
    }

    const sessionId = context.bindingData?.id;
    if (!sessionId) {
      return (context.res = {
        status: 400,
        body: { error: 'Sessão inválida.' },
      });
    }

    const session = await retrieveStripeSession(sessionId, stripeSecretKey);

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        id: session.id,
        status: session.status,
        payment_status: session.payment_status,
        customer_email: session.customer_email || session?.customer_details?.email,
      },
    };
  } catch (error) {
    context.log.error('Erro ao buscar sessão de checkout:', error);
    context.res = {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: { error: error?.message || 'Erro ao buscar sessão de pagamento.' },
    };
  }
};
