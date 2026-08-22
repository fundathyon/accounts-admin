import { errorResponse, proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

export async function GET(request: Request) {
  const auth = requireSecretKey(request, 'Secret API Key es requerida (X-Secret-API-Key).');
  if (auth.error) return auth.error;

  return proxyToAccounts('/api/v1/oauth-configs', {
    method: 'GET',
    headers: {
      'X-API-KEY': auth.key,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
}

export async function POST(request: Request) {
  const auth = requireSecretKey(request, 'Secret API Key es requerida (X-Secret-API-Key).');
  if (auth.error) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Cuerpo inválido.', 400);
  }

  return proxyToAccounts('/api/v1/oauth-configs', {
    method: 'POST',
    headers: {
      'X-API-KEY': auth.key,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
}
