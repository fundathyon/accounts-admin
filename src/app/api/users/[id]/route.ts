import { NextResponse } from 'next/server';
import { proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = requireSecretKey(request);
  if (auth.error) return auth.error;

  return proxyToAccounts(`/api/v1/users/${id}`, {
    headers: {
      'X-API-KEY': auth.key,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = requireSecretKey(request);
  if (auth.error) return auth.error;

  if (!id) {
    return NextResponse.json(
      { success: false, error: { message: 'ID de usuario es requerido.' } },
      { status: 400 }
    );
  }

  return proxyToAccounts(`/api/v1/users/${id}`, {
    method: 'DELETE',
    headers: {
      'X-API-KEY': auth.key,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
}
