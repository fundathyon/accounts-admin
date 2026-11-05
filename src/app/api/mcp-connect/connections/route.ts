import { pickQuery, proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

const PARAMS = ['resource_id', 'user_id', 'email', 'client_id', 'status', 'page', 'size'] as const;

export async function GET(request: Request) {
  const auth = requireSecretKey(request);
  if (auth.error) return auth.error;

  return proxyToAccounts(`/v1/mcp/connections${pickQuery(request, PARAMS)}`, {
    headers: {
      'X-API-KEY': auth.key,
      Accept: 'application/json',
    },
    cache: 'no-store',
    parse: 'empty-ok',
    errorMessage: 'Error al cargar las conexiones.',
  });
}
