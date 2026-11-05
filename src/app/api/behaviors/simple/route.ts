import { errorResponse, proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

/** Creates a behavior from the backend's predefined config: `{ behavior_code }`. */
export async function POST(request: Request) {
  const auth = requireSecretKey(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    return await proxyToAccounts('/api/v1/app-behaviors/simple', {
      method: 'POST',
      headers: {
        'X-API-KEY': auth.key,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      parse: 'empty-ok',
    });
  } catch {
    return errorResponse('Error al crear el behavior.', 500);
  }
}
