import { proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

/** Community and Pro. Writes the `email_code` node; `{ enabled: false }` turns it off (there is no deactivate route). */
export async function POST(request: Request) {
  const auth = requireSecretKey(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  return proxyToAccounts('/api/v1/app-behaviors/email/email-code/activate', {
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
