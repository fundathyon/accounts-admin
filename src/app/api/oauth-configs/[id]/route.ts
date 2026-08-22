import { errorResponse, proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

type RouteParams = { params: Promise<{ id: string }> };

function getSecretKeyAndId(request: Request, id: string | undefined) {
  const auth = requireSecretKey(request, 'Secret API Key es requerida (X-Secret-API-Key).');
  if (auth.error) return { error: auth.error };
  if (!id) {
    return { error: errorResponse('ID del proveedor es requerido.', 400) };
  }
  return { secretKey: auth.key, id };
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const parsed = getSecretKeyAndId(request, id);
  if ('error' in parsed) return parsed.error;
  const { secretKey, id: configId } = parsed;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Cuerpo inválido.', 400);
  }

  return proxyToAccounts(`/api/v1/oauth-configs/${encodeURIComponent(configId)}`, {
    method: 'PATCH',
    headers: {
      'X-API-KEY': secretKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const parsed = getSecretKeyAndId(request, id);
  if ('error' in parsed) return parsed.error;
  const { secretKey, id: configId } = parsed;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Cuerpo inválido.', 400);
  }

  return proxyToAccounts(`/api/v1/oauth-configs/${encodeURIComponent(configId)}`, {
    method: 'PUT',
    headers: {
      'X-API-KEY': secretKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const parsed = getSecretKeyAndId(request, id);
  if ('error' in parsed) return parsed.error;
  const { secretKey, id: configId } = parsed;

  return proxyToAccounts(`/api/v1/oauth-configs/${encodeURIComponent(configId)}`, {
    method: 'DELETE',
    headers: {
      'X-API-KEY': secretKey,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
}
