import { NextResponse } from 'next/server';
import { proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

export async function PATCH(
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

  try {
    const body = await request.json();
    const role = body?.role;
    if (typeof role !== 'string' || !role.trim()) {
      return NextResponse.json(
        { success: false, error: { message: 'El campo "role" es requerido.' } },
        { status: 400 }
      );
    }

    return await proxyToAccounts(`/api/v1/users/${encodeURIComponent(id)}/role`, {
      method: 'PATCH',
      headers: {
        'X-API-KEY': auth.key,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ role: role.trim() }),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json(
      { success: false, error: { message: 'Error al conectar con el servidor.' } },
      { status: 500 }
    );
  }
}
