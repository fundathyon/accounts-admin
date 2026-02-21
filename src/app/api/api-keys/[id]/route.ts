import { NextRequest, NextResponse } from 'next/server';
import { INTERNAL_API_URL } from '@/lib/utils';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const secretKey = request.headers.get('X-Secret-API-Key');
  const { id } = await params;

  if (!secretKey) {
    return NextResponse.json(
      { success: false, error: { message: 'Secret API Key es requerida (X-Secret-API-Key).' } },
      { status: 401 }
    );
  }

  if (!id) {
    return NextResponse.json(
      { success: false, error: { message: 'ID de la API Key es requerido.' } },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(`${INTERNAL_API_URL}/api/v1/api-keys/${id}/deactivate`, {
      method: 'PATCH',
      headers: {
        'X-API-KEY': secretKey,
        'Content-Type': 'application/json',
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const secretKey = request.headers.get('X-Secret-API-Key');
  const { id } = await params;

  if (!secretKey) {
    return NextResponse.json(
      { success: false, error: { message: 'Secret API Key es requerida (X-Secret-API-Key).' } },
      { status: 401 }
    );
  }

  if (!id) {
    return NextResponse.json(
      { success: false, error: { message: 'ID de la API Key es requerido.' } },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(`${INTERNAL_API_URL}/api/v1/api-keys/${id}`, {
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
