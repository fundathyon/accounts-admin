import { pickQuery, proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

/** Active connections per user, up to 100 ids (`user_ids=a,b,c`). */
export async function GET(request: Request) {
  const auth = requireSecretKey(request);
  if (auth.error) return auth.error;

  return proxyToAccounts(`/v1/mcp/connections/summary${pickQuery(request, ['user_ids'])}`, {
    headers: {
      'X-API-KEY': auth.key,
      Accept: 'application/json',
    },
    cache: 'no-store',
    parse: 'empty-ok',
    errorMessage: 'Error al cargar el resumen de conexiones.',
  });
}
