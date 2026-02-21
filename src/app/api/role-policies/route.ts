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
    const body = await request.json();
    const res = await fetch(`${INTERNAL_API_URL}/api/v1/role_policies`, {
      method: 'POST',
      headers: {
        'X-API-KEY': secretKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { success: false, error: { message: 'Error al asignar la política al rol.' } },
      { status: 500 }
    );
  }
}
