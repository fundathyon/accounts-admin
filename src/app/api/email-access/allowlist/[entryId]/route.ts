import { errorResponse, proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

type RouteContext = { params: Promise<{ entryId: string }> };

export async function DELETE(request: Request, context: RouteContext) {
  const auth = requireSecretKey(request);
  if (auth.error) return auth.error;

  const { entryId } = await context.params;
  if (!entryId) {
    return errorResponse('entry_id es requerido.', 400);
  }

  return proxyToAccounts(`/api/v1/email-access/allowlist/${encodeURIComponent(entryId)}`, {
    method: 'DELETE',
    headers: {
      'X-API-KEY': auth.key,
      Accept: 'application/json',
    },
    errorMessage: 'Error al eliminar la entrada.',
  });
}
