import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.5';

interface PayUnitPaymentRequest {
  tenant_id: string;
  integration_connection_id: string;
  amount: number;
  currency: string;
  phone?: string;
  email?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

interface PayUnitRefundRequest {
  tenant_id: string;
  transaction_reference: string;
  amount?: number;
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);

async function getPayUnitCredentials(tenant_id: string, connection_id: string) {
  const { data: connection, error: connError } = await supabase
    .from('integration_connections')
    .select('integration_credentials(credentials)')
    .eq('id', connection_id)
    .eq('tenant_id', tenant_id)
    .single();

  if (connError || !connection) {
    throw new Error('PayUnit connection not found');
  }

  const credentials = connection.integration_credentials?.credentials;
  if (!credentials?.api_key || !credentials?.merchant_id) {
    throw new Error('PayUnit credentials incomplete');
  }

  return {
    api_key: credentials.api_key,
    merchant_id: credentials.merchant_id,
    test_mode: credentials.test_mode ?? true,
  };
}

async function initializePayment(req: PayUnitPaymentRequest) {
  const creds = await getPayUnitCredentials(req.tenant_id, req.integration_connection_id);

  const baseUrl = creds.test_mode 
    ? 'https://api.sandbox.payunit.net/v1'
    : 'https://api.payunit.net/v1';

  const payload = {
    merchant_id: creds.merchant_id,
    amount: Math.round(req.amount * 100), // Convert to cents
    currency: req.currency,
    phone: req.phone,
    email: req.email,
    description: req.description || 'Payment via POS Flow',
    reference: `posflow_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    metadata: req.metadata,
    redirect_url: `${Deno.env.get('PUBLIC_SITE_URL')}/payment/callback`,
  };

  const response = await fetch(`${baseUrl}/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${creds.api_key}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`PayUnit API error: ${response.status} - ${error}`);
  }

  const result = await response.json();

  // Log transaction
  await supabase.from('integration_sync_logs').insert({
    tenant_id: req.tenant_id,
    integration_provider_id: (await supabase
      .from('integration_providers')
      .select('id')
      .eq('name', 'payunit')
      .single()).data?.id,
    sync_type: 'payment_init',
    status: 'completed',
    records_processed: 1,
    data: {
      reference: payload.reference,
      amount: req.amount,
      currency: req.currency,
      status: 'initiated',
    },
  });

  return {
    success: true,
    reference: payload.reference,
    transaction_id: result.transaction_id,
    payment_url: result.payment_url,
    amount: req.amount,
    currency: req.currency,
  };
}

async function verifyPayment(tenant_id: string, connection_id: string, transaction_reference: string) {
  const creds = await getPayUnitCredentials(tenant_id, connection_id);

  const baseUrl = creds.test_mode 
    ? 'https://api.sandbox.payunit.net/v1'
    : 'https://api.payunit.net/v1';

  const response = await fetch(`${baseUrl}/transactions/${transaction_reference}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${creds.api_key}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`PayUnit verification failed: ${response.status}`);
  }

  const transaction = await response.json();

  return {
    success: true,
    status: transaction.status,
    amount: transaction.amount / 100, // Convert from cents
    currency: transaction.currency,
    reference: transaction.reference,
    completed_at: transaction.completed_at,
  };
}

async function refundPayment(req: PayUnitRefundRequest) {
  const creds = await getPayUnitCredentials(req.tenant_id, ''); // Connection ID from metadata

  const baseUrl = creds.test_mode 
    ? 'https://api.sandbox.payunit.net/v1'
    : 'https://api.payunit.net/v1';

  const payload = {
    transaction_reference: req.transaction_reference,
    amount: req.amount ? Math.round(req.amount * 100) : undefined, // Partial refund
  };

  const response = await fetch(`${baseUrl}/transactions/${req.transaction_reference}/refund`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${creds.api_key}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`PayUnit refund failed: ${response.status} - ${error}`);
  }

  const result = await response.json();

  return {
    success: true,
    refund_id: result.refund_id,
    status: result.status,
    reference: req.transaction_reference,
  };
}

serve(async (req: Request) => {
  try {
    const { action, ...payload } = await req.json();

    let result;

    switch (action) {
      case 'initialize_payment':
        result = await initializePayment(payload as PayUnitPaymentRequest);
        break;

      case 'verify_payment':
        result = await verifyPayment(
          payload.tenant_id,
          payload.connection_id,
          payload.transaction_reference
        );
        break;

      case 'refund_payment':
        result = await refundPayment(payload as PayUnitRefundRequest);
        break;

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400 });
    }

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
