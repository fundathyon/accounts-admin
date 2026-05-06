import { NextResponse } from 'next/server';
import { INTERNAL_API_URL } from '@/lib/utils';

type RouteParams = { params: Promise<{ id: string }> };

function checkAuth(request: Request, id: string | undefined) {
  const secretKey = request.headers.get('X-Secret-API-Key');
  if (!secretKey) {
    return {
      error: NextResponse.json(
        { success: false, error: { message: 'Secret API Key es requerida (X-Secret-API-Key).' } },
        { status: 401 }
      ),
    };
  }
  if (!id) {
    return {
      error: NextResponse.json(
        { success: false, error: { message: 'ID del proveedor es requerido.' } },
        { status: 400 }
      ),
    };
  }
  return { secretKey, id };
}

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const parsed = checkAuth(request, id);
  if ('error' in parsed) return parsed.error;

  try {
    const res = await fetch(
      `${INTERNAL_API_URL}/api/v1/oauth-configs/${encodeURIComponent(parsed.id)}/audiences`,
      {
        headers: { 'X-API-KEY': parsed.secretKey, Accept: 'application/json' },
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

export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const parsed = checkAuth(request, id);
  if ('error' in parsed) return parsed.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { message: 'Cuerpo inválido.' } },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(
      `${INTERNAL_API_URL}/api/v1/oauth-configs/${encodeURIComponent(parsed.id)}/audiences`,
      {
        method: 'POST',
        headers: {
          'X-API-KEY': parsed.secretKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
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
