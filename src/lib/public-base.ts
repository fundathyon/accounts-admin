/**
 * Browser-facing base of the Accounts API, e.g. `https://api.example.com/accounts`.
 *
 * It is the base of the OAuth Callback URI (`{base}/api/v1/oauth/{callback_key}`),
 * which Accounts stores and sends to the provider as `redirect_uri`, and the
 * default URL of the Embedded Auth snippet. Both are opened by end users'
 * browsers, so the internal address (`INTERNAL_API_URL`, e.g.
 * `http://prod-accounts-api:8000/accounts`) cannot be it: the provider would
 * send the user to a host nobody can resolve.
 *
 * Falls back to the internal URL only when that one is a loopback address,
 * which is the local setup where both are the same. Anywhere else a missing
 * `ACCOUNTS_PUBLIC_URL` returns '' so the UI says so instead of storing a
 * Callback URI that silently breaks the login.
 */
export function resolvePublicBase(publicUrl: string | undefined, internalUrl: string): string {
  const explicit = (publicUrl ?? '').trim().replace(/\/+$/, '');
  if (explicit) return explicit;
  return isLoopback(internalUrl) ? internalUrl.trim().replace(/\/+$/, '') : '';
}

function isLoopback(raw: string): boolean {
  try {
    const host = new URL(raw).hostname.replace(/^\[|\]$/g, '');
    return host === 'localhost' || host.endsWith('.localhost') || host === '::1' || /^127\./.test(host);
  } catch {
    return false;
  }
}
