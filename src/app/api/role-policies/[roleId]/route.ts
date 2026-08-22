import { NextResponse } from 'next/server';
import { proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ roleId: string }> }
) {
  const auth = requireSecretKey(request);
  if (auth.error) return auth.error;

  const { roleId } = await params;
  if (!roleId) {
    return NextResponse.json(
      { success: false, error: { message: 'roleId es requerido.' } },
      { status: 400 }
    );
  }

  return proxyToAccounts(`/api/v1/role_policies/${roleId}`, {
    headers: {
      'X-API-KEY': auth.key,
      'Accept': 'application/json',
    },
    cache: 'no-store',
  });
}
