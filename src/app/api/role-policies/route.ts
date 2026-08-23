import { errorResponse, proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

export async function POST(request: Request) {
  const auth = requireSecretKey(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    return await proxyToAccounts('/api/v1/role_policies', {
      method: 'POST',
      headers: {
        'X-API-KEY': auth.key,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
      errorMessage: 'Error al asignar la política al rol.',
    });
  } catch {
    return errorResponse('Error al asignar la política al rol.', 500);
  }
}
