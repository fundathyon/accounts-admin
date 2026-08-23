import { errorResponse, proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

export async function POST(request: Request) {
  const auth = requireSecretKey(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    return proxyToAccounts('/api/v1/app-behaviors/email/metadata-schema/activate', {
      method: 'POST',
      headers: {
        'X-API-KEY': auth.key,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    return errorResponse('Error al conectar con el servidor.', 500);
  }
}
