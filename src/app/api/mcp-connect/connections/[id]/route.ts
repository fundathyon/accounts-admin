import { proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

/** Revokes the connection and its session. */
export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const auth = requireSecretKey(request);
  if (auth.error) return auth.error;

  const { id } = await props.params;
  return proxyToAccounts(`/v1/mcp/connections/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      'X-API-KEY': auth.key,
      Accept: 'application/json',
    },
    cache: 'no-store',
    parse: 'empty-ok',
    errorMessage: 'Error al revocar la conexión.',
  });
}
