import { errorResponse, proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

export async function GET(request: Request) {
  const auth = requireSecretKey(request, 'Secret API Key es requerida (X-Secret-API-Key).');
  if (auth.error) return auth.error;

  return proxyToAccounts('/api/v1/email-access/settings', {
    method: 'GET',
    headers: {
      'X-API-KEY': auth.key,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
}

export async function PUT(request: Request) {
  const auth = requireSecretKey(request, 'Secret API Key es requerida (X-Secret-API-Key).');
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    return await proxyToAccounts('/api/v1/email-access/settings', {
      method: 'PUT',
      headers: {
        'X-API-KEY': auth.key,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      errorMessage: 'Error al actualizar la configuración.',
    });
  } catch {
    return errorResponse('Error al actualizar la configuración.', 500);
  }
}
