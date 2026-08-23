import { NextResponse } from 'next/server';
import { proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

/**
 * POST: Revoca el refresh token cuyo JWT se envía en Authorization: Bearer <refresh_token>.
 * Requiere X-Secret-API-Key (se reenvía como X-API-KEY a la API de accounts).
 * Proxies to POST /api/v1/revoke-refresh
 */
export async function POST(request: Request) {
  const auth = requireSecretKey(request, 'Secret API Key es requerida (X-Secret-API-Key).');
  if (auth.error) return auth.error;

  const authHeader = request.headers.get('Authorization');
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

  return proxyToAccounts('/api/v1/revoke-refresh', {
    method: 'POST',
    headers: {
      'X-API-KEY': auth.key,
      Authorization: `Bearer ${refreshToken}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
}
