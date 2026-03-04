import { NextResponse } from 'next/server';
import { INTERNAL_API_URL } from '@/lib/utils';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const secretKey = request.headers.get('X-Secret-API-Key');

  if (!secretKey) {
    return NextResponse.json(
      { success: false, error: { message: 'Secret API Key es requerida.' } },
      { status: 401 }
    );
  }

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

    const res = await fetch(`${INTERNAL_API_URL}/api/v1/users/${encodeURIComponent(id)}/role`, {
      method: 'PATCH',
      headers: {
        'X-API-KEY': secretKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ role: role.trim() }),
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
