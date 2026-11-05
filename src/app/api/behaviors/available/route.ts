import { proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

/** The catalog `POST /simple` can create from, localized by `Accept-Language`. */
export async function GET(request: Request) {
  const auth = requireSecretKey(request);
  if (auth.error) return auth.error;

  return proxyToAccounts('/api/v1/app-behaviors/available', {
    headers: {
      Accept: 'application/json',
      'Accept-Language': request.headers.get('Accept-Language') ?? 'en',
    },
    cache: 'no-store',
    parse: 'empty-ok',
  });
}
