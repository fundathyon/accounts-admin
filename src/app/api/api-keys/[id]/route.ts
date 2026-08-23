import { NextRequest } from 'next/server';
import { errorResponse, proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireSecretKey(request, 'Secret API Key es requerida (X-Secret-API-Key).');
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!id) {
    return errorResponse('ID de la API Key es requerido.', 400);
  }

  return proxyToAccounts(`/api/v1/api-keys/${id}/deactivate`, {
    method: 'PATCH',
    headers: {
      'X-API-KEY': auth.key,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireSecretKey(request, 'Secret API Key es requerida (X-Secret-API-Key).');
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!id) {
    return errorResponse('ID de la API Key es requerido.', 400);
  }

  return proxyToAccounts(`/api/v1/api-keys/${id}`, {
    method: 'DELETE',
    headers: {
      'X-API-KEY': auth.key,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
}
