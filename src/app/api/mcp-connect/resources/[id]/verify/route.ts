import { proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

/** Accounts probes the MCP server and reports each check. */
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const auth = requireSecretKey(request);
  if (auth.error) return auth.error;

  const { id } = await props.params;
  return proxyToAccounts(`/v1/mcp-resources/${encodeURIComponent(id)}/verify`, {
    method: 'POST',
    headers: {
      'X-API-KEY': auth.key,
      Accept: 'application/json',
    },
    cache: 'no-store',
    parse: 'empty-ok',
    errorMessage: 'Error al verificar el servidor MCP.',
  });
}
