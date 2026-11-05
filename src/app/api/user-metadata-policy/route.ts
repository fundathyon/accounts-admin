import { errorResponse, proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

/** Pro only: in Community the route does not exist; `empty-ok` keeps that 404. */
const BACKEND_PATH = '/api/v1/user-metadata-policy';

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
    errorMessage: 'Error al cargar la política de metadata.',
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
      errorMessage: 'Error al guardar la política de metadata.',
    });
  } catch {
    return errorResponse('Error al guardar la política de metadata.', 500);
  }
}
