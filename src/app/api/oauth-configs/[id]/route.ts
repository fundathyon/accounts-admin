import { NextResponse } from 'next/server';
import { INTERNAL_API_URL } from '@/lib/utils';

type RouteParams = { params: Promise<{ id: string }> };

function getSecretKeyAndId(request: Request, id: string | undefined) {
  const secretKey = request.headers.get('X-Secret-API-Key');
  if (!secretKey) {
    return { error: NextResponse.json(
      { success: false, error: { message: 'Secret API Key es requerida (X-Secret-API-Key).' } },
      { status: 401 }
    ) };
  }
  if (!id) {
    return { error: NextResponse.json(
      { success: false, error: { message: 'ID del proveedor es requerido.' } },
      { status: 400 }
    ) };
  }
  return { secretKey, id };
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const parsed = getSecretKeyAndId(request, id);
  if ('error' in parsed) return parsed.error;
  const { secretKey, id: configId } = parsed;

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
    const res = await fetch(`${INTERNAL_API_URL}/api/v1/oauth-configs/${encodeURIComponent(configId)}`, {
      method: 'PATCH',
      headers: {
        'X-API-KEY': secretKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
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

export async function PUT(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const parsed = getSecretKeyAndId(request, id);
  if ('error' in parsed) return parsed.error;
  const { secretKey, id: configId } = parsed;

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
    const res = await fetch(`${INTERNAL_API_URL}/api/v1/oauth-configs/${encodeURIComponent(configId)}`, {
      method: 'PUT',
      headers: {
        'X-API-KEY': secretKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
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

export async function DELETE(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const parsed = getSecretKeyAndId(request, id);
  if ('error' in parsed) return parsed.error;
  const { secretKey, id: configId } = parsed;

  try {
    const res = await fetch(`${INTERNAL_API_URL}/api/v1/oauth-configs/${encodeURIComponent(configId)}`, {
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
