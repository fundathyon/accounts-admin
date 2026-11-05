import { errorResponse, proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

/**
 * Pro only: the `geo_access` behavior. In Community the path falls into the
 * generic `/app-behaviors/:id` routes, which answer a JSON 404. The body of the
 * PUT is forwarded as is.
 */
const BACKEND_PATH = '/api/v1/app-behaviors/geo-access';

export async function GET(request: Request) {
  const auth = requireSecretKey(request);
  if (auth.error) return auth.error;

  return proxyToAccounts(BACKEND_PATH, {
    headers: {
      'X-API-KEY': auth.key,
      Accept: 'application/json',
    },
    cache: 'no-store',
    errorMessage: 'Error al cargar el Bloqueo regional.',
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
      errorMessage: 'Error al guardar el Bloqueo regional.',
    });
  } catch {
    return errorResponse('Error al guardar el Bloqueo regional.', 500);
  }
}
