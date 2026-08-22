import { errorResponse, proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

type RouteParams = { params: Promise<{ id: string }> };

function checkAuth(request: Request, id: string | undefined) {
  const auth = requireSecretKey(request, 'Secret API Key es requerida (X-Secret-API-Key).');
  if (auth.error) return { error: auth.error };
  if (!id) {
    return { error: errorResponse('ID del proveedor es requerido.', 400) };
  }
  return { secretKey: auth.key, id };
}

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const parsed = checkAuth(request, id);
  if ('error' in parsed) return parsed.error;

  return proxyToAccounts(`/api/v1/oauth-configs/${encodeURIComponent(parsed.id)}/audiences`, {
    headers: { 'X-API-KEY': parsed.secretKey, Accept: 'application/json' },
    cache: 'no-store',
  });
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const parsed = checkAuth(request, id);
  if ('error' in parsed) return parsed.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Cuerpo inválido.', 400);
  }

  return proxyToAccounts(`/api/v1/oauth-configs/${encodeURIComponent(parsed.id)}/audiences`, {
    method: 'POST',
    headers: {
      'X-API-KEY': parsed.secretKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
}
