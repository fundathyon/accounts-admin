import { errorResponse, proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

export async function GET(request: Request) {
  const auth = requireSecretKey(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const page = searchParams.get('page') || '0';
  const size = searchParams.get('size') || '10';
  const offset = searchParams.get('offset') || '0';

  return proxyToAccounts(`/api/v1/policies?page=${page}&size=${size}&offset=${offset}`, {
    headers: {
      'X-API-KEY': auth.key,
      'Accept': 'application/json',
    },
    cache: 'no-store',
  });
}

export async function POST(request: Request) {
  const auth = requireSecretKey(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    return proxyToAccounts('/api/v1/policies', {
      method: 'POST',
      headers: {
        'X-API-KEY': auth.key,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
      errorMessage: 'Error al crear la política.',
    });
  } catch {
    return errorResponse('Error al crear la política.', 500);
  }
}
