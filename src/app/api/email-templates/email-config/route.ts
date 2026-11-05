import { proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

/**
 * The sender of the instance, read only. Accounts only serves it with a secret
 * key, in both editions: there is no operator route.
 */
export async function GET(request: Request) {
  const auth = requireSecretKey(request);
  if (auth.error) return auth.error;

  return proxyToAccounts('/api/v1/email-config', {
    headers: { 'X-API-KEY': auth.key, Accept: 'application/json' },
    cache: 'no-store',
    parse: 'empty-ok',
  });
}
