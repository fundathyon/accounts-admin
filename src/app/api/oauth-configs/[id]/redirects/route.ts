import { errorResponse, proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const auth = requireSecretKey(request, 'Secret API Key es requerida (X-Secret-API-Key).');
  if (auth.error) return auth.error;
  if (!id) {
    return errorResponse('ID del proveedor es requerido.', 400);
  }

  return proxyToAccounts(`/api/v1/oauth-configs/${encodeURIComponent(id)}/redirects`, {
    headers: {
      'X-API-KEY': auth.key,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
}
