import { errorResponse, proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

/**
 * Pro only: the `tokens` behavior. The static segment wins over `behaviors/[id]`.
 * The screen does not call this route in Community, where the backend does not
 * register it.
 */
const BACKEND_PATH = '/api/v1/app-behaviors/tokens';

export async function GET(request: Request) {
  const auth = requireSecretKey(request);
  if (auth.error) return auth.error;

  return proxyToAccounts(BACKEND_PATH, {
    headers: {
      'X-API-KEY': auth.key,
      Accept: 'application/json',
    },
    cache: 'no-store',
    parse: 'empty-ok',
    errorMessage: 'Error al cargar el behavior tokens.',
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
      parse: 'empty-ok',
      errorMessage: 'Error al guardar el behavior tokens.',
    });
  } catch {
    return errorResponse('Error al guardar el behavior tokens.', 500);
  }
}
