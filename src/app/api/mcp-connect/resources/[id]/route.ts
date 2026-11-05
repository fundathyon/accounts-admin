import { errorResponse, proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

type Props = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, props: Props) {
  const auth = requireSecretKey(request);
  if (auth.error) return auth.error;

  const { id } = await props.params;
  try {
    const body = await request.json();
    return await proxyToAccounts(`/v1/mcp-resources/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        'X-API-KEY': auth.key,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      parse: 'empty-ok',
      errorMessage: 'Error al actualizar el servidor MCP.',
    });
  } catch {
    return errorResponse('Error al actualizar el servidor MCP.', 500);
  }
}

export async function DELETE(request: Request, props: Props) {
  const auth = requireSecretKey(request);
  if (auth.error) return auth.error;

  const { id } = await props.params;
  return proxyToAccounts(`/v1/mcp-resources/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      'X-API-KEY': auth.key,
      Accept: 'application/json',
    },
    cache: 'no-store',
    parse: 'empty-ok',
    errorMessage: 'Error al eliminar el servidor MCP.',
  });
}
