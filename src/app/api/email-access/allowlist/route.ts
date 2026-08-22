import { errorResponse, proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

function buildListUrl(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get('page') ?? '0';
  const size = searchParams.get('size') ?? '20';
  const offset = searchParams.get('offset') ?? '0';
  return `/api/v1/email-access/allowlist?page=${page}&size=${size}&offset=${offset}`;
}

export async function GET(request: Request) {
  const auth = requireSecretKey(request);
  if (auth.error) return auth.error;

  return proxyToAccounts(buildListUrl(request), {
    headers: {
      'X-API-KEY': auth.key,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
}

export async function POST(request: Request) {
  const auth = requireSecretKey(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    return await proxyToAccounts('/api/v1/email-access/allowlist', {
      method: 'POST',
      headers: {
        'X-API-KEY': auth.key,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      errorMessage: 'Error al crear la entrada.',
    });
  } catch {
    return errorResponse('Error al crear la entrada.', 500);
  }
}
