import { NextResponse } from 'next/server';
import { INTERNAL_API_URL } from '@/lib/utils';

export async function POST(request: Request) {
  const secretKey = request.headers.get('X-Secret-API-Key');

  if (!secretKey) {
    return NextResponse.json(
      { success: false, error: { message: 'Secret API Key es requerida.' } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const res = await fetch(`${INTERNAL_API_URL}/api/v1/app-behaviors/email/magic-link/activate`, {
      method: 'POST',
      headers: {
        'X-API-KEY': secretKey,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
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
