import { errorResponse, proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

/** Replaces the whole list of scopes. */
export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
  const auth = requireSecretKey(request);
  if (auth.error) return auth.error;

  const { id } = await props.params;
  try {
    const body = await request.json();
    return await proxyToAccounts(`/v1/mcp-resources/${encodeURIComponent(id)}/scopes`, {
      method: 'PUT',
      headers: {
        'X-API-KEY': auth.key,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      parse: 'empty-ok',
      errorMessage: 'Error al guardar los permisos.',
    });
  } catch {
    return errorResponse('Error al guardar los permisos.', 500);
  }
}
