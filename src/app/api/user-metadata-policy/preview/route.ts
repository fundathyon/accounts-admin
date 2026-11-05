import { errorResponse, proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

export async function POST(request: Request) {
  const auth = requireSecretKey(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    return await proxyToAccounts('/api/v1/user-metadata-policy/preview', {
      method: 'POST',
      headers: {
        'X-API-KEY': auth.key,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      parse: 'empty-ok',
      errorMessage: 'Error al evaluar la política de metadata.',
    });
  } catch {
    return errorResponse('Error al evaluar la política de metadata.', 500);
  }
}
