import { NextResponse } from 'next/server';
import { INTERNAL_API_URL } from '@/lib/utils';

/**
 * Proxies signup to accounts API.
 * Requires X-Publishable-API-Key header (publishable key from app).
 * Body: { email, password, user_name? }
 */
export async function POST(request: Request) {
  const publishableKey = request.headers.get('X-Publishable-API-Key');
  if (!publishableKey) {
    return NextResponse.json(
      { success: false, error: { message: 'Publishable API Key es requerida. Configúrala en Ajustes.' } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const res = await fetch(`${INTERNAL_API_URL}/api/v1/emails/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': publishableKey,
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { success: false, error: { message: 'Error al conectar con la API' } },
      { status: 500 }
    );
  }
}
