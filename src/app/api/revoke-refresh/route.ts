import { NextResponse } from 'next/server';
import { INTERNAL_API_URL } from '@/lib/utils';

/**
 * POST: Revoca el refresh token cuyo JWT se envía en Authorization: Bearer <refresh_token>.
 * Requiere X-Secret-API-Key (se reenvía como X-API-KEY a la API de accounts).
 * Proxies to POST /api/v1/revoke-refresh
 */
export async function POST(request: Request) {
  const secretKey = request.headers.get('X-Secret-API-Key');
  const authHeader = request.headers.get('Authorization');

  if (!secretKey) {
    return NextResponse.json(
      { success: false, error: { message: 'Secret API Key es requerida (X-Secret-API-Key).' } },
      { status: 401 }
    );
  }

  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { success: false, error: { message: 'Authorization: Bearer <refresh_token> es requerido.' } },
      { status: 400 }
    );
  }

  const refreshToken = authHeader.slice(7).trim();
  if (!refreshToken) {
    return NextResponse.json(
      { success: false, error: { message: 'El refresh token no puede estar vacío.' } },
      { status: 400 }
    );
  }

  try {
    const url = `${INTERNAL_API_URL}/api/v1/revoke-refresh`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'X-API-KEY': secretKey,
        Authorization: `Bearer ${refreshToken}`,
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
