import { proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

export async function POST(request: Request) {
  const auth = requireSecretKey(request);
  if (auth.error) return auth.error;

  return proxyToAccounts('/api/v1/app-behaviors/email/magic-link/deactivate', {
    method: 'POST',
    headers: {
      'X-API-KEY': auth.key,
      'Accept': 'application/json',
    },
    cache: 'no-store',
  });
}
