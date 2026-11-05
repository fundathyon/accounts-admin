import { errorResponse, proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

/**
 * Community and Pro: the `email_locale` behavior (default language of the emails).
 * The row is created by the first PUT.
 */
const BACKEND_PATH = '/api/v1/app-behaviors/email-locale';

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
    errorMessage: 'Error al cargar el idioma de los correos.',
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
      errorMessage: 'Error al guardar el idioma de los correos.',
    });
  } catch {
    return errorResponse('Error al guardar el idioma de los correos.', 500);
  }
}
