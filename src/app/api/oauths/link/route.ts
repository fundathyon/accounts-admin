import { NextResponse } from 'next/server';
import { INTERNAL_API_URL } from '@/lib/utils';

export async function GET(request: Request) {
  const publishableKey = request.headers.get('X-Publishable-API-Key') ?? request.headers.get('X-Api-Key');
  if (!publishableKey) {
    return NextResponse.json(
      { success: false, error: { message: 'Publishable API Key es requerida (X-Publishable-API-Key).' } },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const provider = searchParams.get('provider');
  const platform = searchParams.get('platform');
  const role = searchParams.get('role');
  const redirectUrl = searchParams.get('redirect_url');
  const rt = searchParams.get('rt');

  if (!provider || !platform) {
    return NextResponse.json(
      { success: false, error: { message: 'provider y platform son requeridos.' } },
      { status: 400 }
    );
  }

  try {
    const url = new URL(`${INTERNAL_API_URL}/api/v1/oauths/link`);
    url.searchParams.set('provider', provider);
    url.searchParams.set('platform', platform);
    if (role) url.searchParams.set('role', role);
    if (redirectUrl) url.searchParams.set('redirect_url', redirectUrl);
    if (rt) url.searchParams.set('rt', rt);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-API-KEY': publishableKey,
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
