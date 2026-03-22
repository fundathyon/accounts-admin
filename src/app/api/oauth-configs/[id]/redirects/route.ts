import { NextResponse } from 'next/server';
import { INTERNAL_API_URL } from '@/lib/utils';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const secretKey = request.headers.get('X-Secret-API-Key');
  if (!secretKey) {
    return NextResponse.json(
      { success: false, error: { message: 'Secret API Key es requerida (X-Secret-API-Key).' } },
      { status: 401 }
    );
  }
  if (!id) {
    return NextResponse.json(
      { success: false, error: { message: 'ID del proveedor es requerido.' } },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(
      `${INTERNAL_API_URL}/api/v1/oauth-configs/${encodeURIComponent(id)}/redirects`,
      {
        headers: {
          'X-API-KEY': secretKey,
          Accept: 'application/json',
        },
        cache: 'no-store',
      }
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { success: false, error: { message: 'Error al conectar con el servidor.' } },
      { status: 500 }
    );
  }
}
