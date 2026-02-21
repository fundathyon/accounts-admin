import { NextResponse } from 'next/server';
import { INTERNAL_API_URL } from '@/lib/utils';

export async function GET(request: Request) {
  const secretKey = request.headers.get('X-Secret-API-Key');
  if (!secretKey) {
    return NextResponse.json(
      { success: false, error: { message: 'Secret API Key es requerida.' } },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const page = searchParams.get('page') || '0';
  const size = searchParams.get('size') || '10';
  const offset = searchParams.get('offset') || '0';

  try {
    const res = await fetch(`${INTERNAL_API_URL}/api/v1/policies?page=${page}&size=${size}&offset=${offset}`, {
      headers: {
        'X-API-KEY': secretKey,
        'Accept': 'application/json',
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
    const res = await fetch(`${INTERNAL_API_URL}/api/v1/policies`, {
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
      { success: false, error: { message: 'Error al crear la política.' } },
      { status: 500 }
    );
  }
}
