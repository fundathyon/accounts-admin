import { pickQuery, proxyToAccounts, requireAdminKey, requireSecretKey } from '@/lib/accounts-api';
import { EMAIL_SCOPE_GLOBAL, EMAIL_SCOPE_HEADER } from '@/lib/email-templates';

/**
 * One tree for Accounts' two route families. By default a request acts on the
 * app of its secret key; `X-Email-Templates-Scope: global` acts on the instance
 * with the admin key, which never leaves this server. The screen picks the scope
 * from the edition (see `src/lib/email-templates.ts`).
 */
export async function proxyEmailTemplates(request: Request, path: string, init: RequestInit = {}) {
  const global = request.headers.get(EMAIL_SCOPE_HEADER) === EMAIL_SCOPE_GLOBAL;
  const auth = global ? requireAdminKey() : requireSecretKey(request);
  if (auth.error) return auth.error;

  const base = global ? '/v1/email-templates' : '/api/v1/email-templates';
  const method = init.method ?? 'GET';
  const body = method === 'GET' || method === 'DELETE' ? undefined : await request.text();
  return proxyToAccounts(`${base}${path}${pickQuery(request, ['locale'])}`, {
    ...init,
    body,
    method,
    headers: {
      [global ? 'X-Admin-API-Key' : 'X-API-KEY']: auth.key,
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    cache: 'no-store',
    // A plain-text 404 (an API without these routes) stays a 404, not a 500.
    parse: 'empty-ok',
  });
}
