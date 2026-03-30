import { NextResponse } from 'next/server';
import { INTERNAL_API_URL } from '@/lib/utils';

export async function GET(request: Request) {
  const secretKey = request.headers.get('X-Secret-API-Key');
  if (!secretKey) {
    return NextResponse.json(
      { success: false, error: { message: 'Secret API Key es requerida (X-Secret-API-Key).' } },
      { status: 401 }
    );
  }

  try {
    const res = await fetch(`${INTERNAL_API_URL}/api/v1/email-access/settings`, {
      method: 'GET',
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

export async function PUT(request: Request) {
  const secretKey = request.headers.get('X-Secret-API-Key');
  if (!secretKey) {
    return NextResponse.json(
      { success: false, error: { message: 'Secret API Key es requerida (X-Secret-API-Key).' } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const res = await fetch(`${INTERNAL_API_URL}/api/v1/email-access/settings`, {
      method: 'PUT',
      headers: {
        'X-API-KEY': secretKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { success: false, error: { message: 'Error al actualizar la configuración.' } },
      { status: 500 }
    );
  }
}
