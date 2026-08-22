import { errorResponse, proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

type RouteParams = { params: Promise<{ id: string; audience_id: string }> };

export async function DELETE(request: Request, { params }: RouteParams) {
  const { id, audience_id } = await params;
  const auth = requireSecretKey(request, 'Secret API Key es requerida (X-Secret-API-Key).');
  if (auth.error) return auth.error;
  if (!id || !audience_id) {
    return errorResponse('IDs requeridos.', 400);
  }

  return proxyToAccounts(
    `/api/v1/oauth-configs/${encodeURIComponent(id)}/audiences/${encodeURIComponent(audience_id)}`,
    {
      method: 'DELETE',
      headers: { 'X-API-KEY': auth.key, Accept: 'application/json' },
      cache: 'no-store',
      parse: 'empty-ok',
    }
  );
}
