import { errorResponse, proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

/**
 * Pro only: the `embedded_auth` behavior (embedded login components). The
 * static segment wins over `behaviors/[id]`, which would forward to the very
 * same backend path anyway. In Community the backend answers a JSON 404
 * (the path falls into the generic `/app-behaviors/:id` routes).
 */
const BACKEND_PATH = '/api/v1/app-behaviors/embedded-auth';

export async function GET(request: Request) {
  const auth = requireSecretKey(request);
  if (auth.error) return auth.error;

  return proxyToAccounts(BACKEND_PATH, {
    headers: {
      'X-API-KEY': auth.key,
      Accept: 'application/json',
    },
    cache: 'no-store',
    errorMessage: 'Error al cargar Embedded Auth.',
  });
}

export async function PUT(request: Request) {
  const auth = requireSecretKey(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    return proxyToAccounts(BACKEND_PATH, {
      method: 'PUT',
      headers: {
        'X-API-KEY': auth.key,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      errorMessage: 'Error al guardar Embedded Auth.',
    });
  } catch {
    return errorResponse('Error al guardar Embedded Auth.', 500);
  }
}
