import { proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

/** Community and Pro. `{ enabled }` turns the `testers` node on or off. */
export async function POST(request: Request) {
  const auth = requireSecretKey(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  return proxyToAccounts('/api/v1/app-behaviors/email/testers/activate', {
    method: 'POST',
    headers: {
      'X-API-KEY': auth.key,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
    parse: 'empty-ok',
  });
}
