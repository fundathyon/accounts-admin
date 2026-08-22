import { proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

export async function GET(request: Request) {
  const auth = requireSecretKey(request, 'Secret API Key es requerida (X-Secret-API-Key).');
  if (auth.error) return auth.error;

  return proxyToAccounts('/api/v1/api-keys', {
    headers: {
      'X-API-KEY': auth.key,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
}
