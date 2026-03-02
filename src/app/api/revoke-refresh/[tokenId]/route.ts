import { NextResponse } from 'next/server';
import { INTERNAL_API_URL } from '@/lib/utils';

/**
 * DELETE: Revoca el refresh token por su ID (claim "id" del JWT).
 * Requiere X-Secret-API-Key (se reenvía como X-API-KEY a la API de accounts).
 * Proxies to DELETE /api/v1/revoke-refresh/:tokenId
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  const secretKey = _request.headers.get('X-Secret-API-Key');
  const { tokenId } = await params;

  if (!secretKey) {
    return NextResponse.json(
      { success: false, error: { message: 'Secret API Key es requerida (X-Secret-API-Key).' } },
      { status: 401 }
    );
  }

  if (!tokenId?.trim()) {
    return NextResponse.json(
      { success: false, error: { message: 'El ID del token es requerido.' } },
      { status: 400 }
    );
  }

  try {
    const url = `${INTERNAL_API_URL}/api/v1/revoke-refresh/${encodeURIComponent(tokenId.trim())}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        'X-API-KEY': secretKey,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { success: false, error: { message: 'Error al conectar con el servidor.' } },
      { status: 500 }
    );
  }
}
