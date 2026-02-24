import { NextResponse } from 'next/server';
import { INTERNAL_API_URL } from '@/lib/utils';

/**
 * POST body: { refresh_token: string }
 * Proxies to GET /api/v1/refresh-jwt with Authorization: Bearer <refresh_token>
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const refreshToken = typeof body?.refresh_token === 'string' ? body.refresh_token.trim() : '';
    if (!refreshToken) {
      return NextResponse.json(
        { success: false, error: { message: 'refresh_token es requerido en el body.' } },
        { status: 400 }
      );
    }
    const url = `${INTERNAL_API_URL}/api/v1/refresh-jwt`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
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
