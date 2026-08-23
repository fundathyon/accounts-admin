import { NextResponse } from 'next/server';
import { proxyToAccounts } from '@/lib/accounts-api';

/**
 * POST body: { token: string }
 * Proxies to GET /api/v1/validate-refresh with Authorization: Bearer <token>
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = typeof body?.token === 'string' ? body.token.trim() : '';
    if (!token) {
      return NextResponse.json(
        { success: false, error: { message: 'token es requerido en el body.' } },
        { status: 400 }
      );
    }
    return await proxyToAccounts('/api/v1/validate-refresh', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
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
