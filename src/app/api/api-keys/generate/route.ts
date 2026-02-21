import { NextResponse } from 'next/server';
import { INTERNAL_API_URL } from '@/lib/utils';

/**
 * Proxies API key generation to accounts API.
 * POST body: { app_id, name, description? }
 * No auth required - the accounts API generate endpoint is unauthenticated.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const res = await fetch(`${INTERNAL_API_URL}/api/v1/api-keys/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
