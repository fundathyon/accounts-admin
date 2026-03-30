import { NextResponse } from 'next/server';
import { INTERNAL_API_URL } from '@/lib/utils';

type RouteContext = { params: Promise<{ entryId: string }> };

export async function DELETE(request: Request, context: RouteContext) {
  const secretKey = request.headers.get('X-Secret-API-Key');
  if (!secretKey) {
    return NextResponse.json(
      { success: false, error: { message: 'Secret API Key es requerida.' } },
      { status: 401 }
    );
  }

  const { entryId } = await context.params;
  if (!entryId) {
    return NextResponse.json(
      { success: false, error: { message: 'entry_id es requerido.' } },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(
      `${INTERNAL_API_URL}/api/v1/email-access/allowlist/${encodeURIComponent(entryId)}`,
      {
        method: 'DELETE',
        headers: {
          'X-API-KEY': secretKey,
          Accept: 'application/json',
        },
      }
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { success: false, error: { message: 'Error al eliminar la entrada.' } },
      { status: 500 }
    );
  }
}
