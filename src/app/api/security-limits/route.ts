import { errorResponse, proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

/**
 * Community and Pro: the `security_limits` behavior. The body of the PUT is
 * forwarded as is (partial update; a `null` returns the field to the instance
 * value).
 */
const BACKEND_PATH = '/api/v1/app-behaviors/security-limits';

export async function GET(request: Request) {
  const auth = requireSecretKey(request);
  if (auth.error) return auth.error;

  return proxyToAccounts(BACKEND_PATH, {
    headers: {
      'X-API-KEY': auth.key,
      Accept: 'application/json',
    },
    cache: 'no-store',
    errorMessage: 'Error al cargar los límites de seguridad.',
  });
}

export async function PUT(request: Request) {
  const auth = requireSecretKey(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    return await proxyToAccounts(BACKEND_PATH, {
      method: 'PUT',
      headers: {
        'X-API-KEY': auth.key,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      errorMessage: 'Error al guardar los límites de seguridad.',
    });
  } catch {
    return errorResponse('Error al guardar los límites de seguridad.', 500);
  }
}
