import { NextRequest, NextResponse } from 'next/server';
import { INTERNAL_API_URL, ADMIN_API_KEY } from '@/lib/utils';

export async function POST(request: NextRequest) {
  if (!ADMIN_API_KEY) {
    return NextResponse.json(
      { success: false, error: { message: 'ADMIN_API_KEY no está configurada.' } },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const res = await fetch(`${INTERNAL_API_URL}/api/v1/system/email-templates/preview`, {
      method: 'POST',
      headers: {
        'X-Admin-API-Key': ADMIN_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
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
