import { errorResponse, proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

// POST /api/email-access/test -> forwards to accounts POST /api/v1/email-access/test.
// Body: { email, access_segment?, flow? } — see backend handler for full schema.
export async function POST(request: Request) {
  const auth = requireSecretKey(request, 'Secret API Key es requerida (X-Secret-API-Key).');
  if (auth.error) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Cuerpo inválido.', 400);
  }

  return proxyToAccounts('/api/v1/email-access/test', {
    method: 'POST',
    headers: {
      'X-API-KEY': auth.key,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body ?? {}),
    cache: 'no-store',
    parse: 'json-safe',
  });
}
