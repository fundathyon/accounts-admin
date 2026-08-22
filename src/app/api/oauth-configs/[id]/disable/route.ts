import { errorResponse, proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const auth = requireSecretKey(request, 'Secret API Key es requerida (X-Secret-API-Key).');
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!id) {
    return errorResponse('ID del proveedor es requerido.', 400);
  }

  return proxyToAccounts(`/api/v1/oauth-configs/${encodeURIComponent(id)}/disable`, {
    method: 'POST',
    headers: {
      'X-API-KEY': auth.key,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
}
