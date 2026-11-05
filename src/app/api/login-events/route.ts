import { pickQuery, proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

/** Community and Pro. Only the known filters go through; `empty-ok` keeps the 404 of an Accounts without this route. */
const PARAMS = ['page', 'size', 'user_id', 'country', 'type', 'method', 'geo_source', 'from', 'to'] as const;

export async function GET(request: Request) {
  const auth = requireSecretKey(request);
  if (auth.error) return auth.error;

  return proxyToAccounts(`/api/v1/login-events${pickQuery(request, PARAMS)}`, {
    headers: {
      'X-API-KEY': auth.key,
      Accept: 'application/json',
    },
    cache: 'no-store',
    parse: 'empty-ok',
    errorMessage: 'Error al cargar los accesos.',
  });
}
