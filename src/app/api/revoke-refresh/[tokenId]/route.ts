import { NextResponse } from 'next/server';
import { proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

/**
 * DELETE: Revoca el refresh token por su ID (claim "id" del JWT).
 * Requiere X-Secret-API-Key (se reenvía como X-API-KEY a la API de accounts).
 * Proxies to DELETE /api/v1/revoke-refresh/:tokenId
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  const auth = requireSecretKey(_request, 'Secret API Key es requerida (X-Secret-API-Key).');
  const { tokenId } = await params;

  if (auth.error) return auth.error;

  if (!tokenId?.trim()) {
    return NextResponse.json(
      { success: false, error: { message: 'El ID del token es requerido.' } },
      { status: 400 }
    );
  }

  return proxyToAccounts(`/api/v1/revoke-refresh/${encodeURIComponent(tokenId.trim())}`, {
    method: 'DELETE',
    headers: {
      'X-API-KEY': auth.key,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
}
