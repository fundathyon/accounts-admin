import { NextResponse } from 'next/server';
import { INTERNAL_API_URL } from '@/lib/utils';

type RouteParams = { params: Promise<{ id: string; audience_id: string }> };

export async function DELETE(request: Request, { params }: RouteParams) {
  const { id, audience_id } = await params;
  const secretKey = request.headers.get('X-Secret-API-Key');
  if (!secretKey) {
    return NextResponse.json(
      { success: false, error: { message: 'Secret API Key es requerida (X-Secret-API-Key).' } },
      { status: 401 }
    );
  }
  if (!id || !audience_id) {
    return NextResponse.json(
      { success: false, error: { message: 'IDs requeridos.' } },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(
      `${INTERNAL_API_URL}/api/v1/oauth-configs/${encodeURIComponent(id)}/audiences/${encodeURIComponent(audience_id)}`,
      {
        method: 'DELETE',
        headers: { 'X-API-KEY': secretKey, Accept: 'application/json' },
        cache: 'no-store',
      }
    );
    if (res.status === 204) {
      return new NextResponse(null, { status: 204 });
    }
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { success: false, error: { message: 'Error al conectar con el servidor.' } },
      { status: 500 }
    );
  }
}
