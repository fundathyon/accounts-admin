import { NextResponse } from 'next/server';
import { proxyToAccounts } from '@/lib/accounts-api';

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
    return await proxyToAccounts('/api/v1/refresh-jwt', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${refreshToken}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json(
      { success: false, error: { message: 'Error al conectar con el servidor.' } },
      { status: 500 }
    );
  }
}
