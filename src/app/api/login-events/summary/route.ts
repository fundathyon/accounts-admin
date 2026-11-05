import { pickQuery, proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

const PARAMS = ['from', 'to'] as const;

export async function GET(request: Request) {
  const auth = requireSecretKey(request);
  if (auth.error) return auth.error;

  return proxyToAccounts(`/api/v1/login-events/summary${pickQuery(request, PARAMS)}`, {
    headers: {
      'X-API-KEY': auth.key,
      Accept: 'application/json',
    },
    cache: 'no-store',
    parse: 'empty-ok',
    errorMessage: 'Error al cargar el resumen de accesos.',
  });
}
