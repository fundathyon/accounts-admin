import { NextResponse } from 'next/server';
import { INTERNAL_API_URL } from '@/lib/utils';

/**
 * Proxies API key generation to accounts API.
 * POST body: { name, description? } — app_id comes from the secret key.
 * Requires X-Secret-API-Key (forwarded as X-API-KEY to accounts).
 */
export async function POST(request: Request) {
  const secretKey = request.headers.get('X-Secret-API-Key');

  if (!secretKey) {
    return NextResponse.json(
      { success: false, error: { message: 'Secret API Key es requerida (X-Secret-API-Key).' } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { name, description } = body as { name?: string; description?: string };
    const payload: Record<string, string> = { name: name ?? '' };
    if (description != null && String(description).trim() !== '') {
      payload.description = String(description).trim();
    }

    const res = await fetch(`${INTERNAL_API_URL}/api/v1/api-keys/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-API-KEY': secretKey,
      },
      body: JSON.stringify(payload),
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
