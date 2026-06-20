import { NextResponse } from 'next/server';
import { INTERNAL_API_URL } from '@/lib/utils';

// POST /api/email-access/test -> forwards to accounts POST /api/v1/email-access/test.
// Body: { email, access_segment?, flow? } — see backend handler for full schema.
export async function POST(request: Request) {
  const secretKey = request.headers.get('X-Secret-API-Key');
  if (!secretKey) {
    return NextResponse.json(
      { success: false, error: { message: 'Secret API Key es requerida (X-Secret-API-Key).' } },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { message: 'Cuerpo inválido.' } },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(`${INTERNAL_API_URL}/api/v1/email-access/test`, {
      method: 'POST',
      headers: {
        'X-API-KEY': secretKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body ?? {}),
      cache: 'no-store',
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { success: false, error: { message: 'Error al conectar con el servidor.' } },
      { status: 500 },
    );
  }
}
