import { NextResponse } from 'next/server';
import { proxyToAccounts, requirePublishableKey } from '@/lib/accounts-api';

export async function GET(request: Request) {
  const auth = requirePublishableKey(
    request,
    'Publishable API Key es requerida (X-Publishable-API-Key).',
    'X-Api-Key'
  );
  if (auth.error) return auth.error;

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
    const url = new URL('/api/v1/oauths/link', 'http://internal');
    url.searchParams.set('provider', provider);
    url.searchParams.set('platform', platform);
    if (role) url.searchParams.set('role', role);
    if (redirectUrl) url.searchParams.set('redirect_url', redirectUrl);
    if (rt) url.searchParams.set('rt', rt);

    return await proxyToAccounts(`${url.pathname}${url.search}`, {
      method: 'GET',
      headers: {
        'X-API-KEY': auth.key,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json(
      { success: false, error: { message: 'Error al conectar con el servidor.' } },
      { status: 500 }
    );
  }
}
