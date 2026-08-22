import { errorResponse, proxyToAccounts, requirePublishableKey } from '@/lib/accounts-api';

/**
 * Proxies signup resend-code to accounts API.
 * Requires X-Publishable-API-Key header.
 * Body: { email }
 */
export async function POST(request: Request) {
  const auth = requirePublishableKey(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    return await proxyToAccounts('/api/v1/emails/signup/resend-code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': auth.key,
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      errorMessage: 'Error al conectar con la API',
    });
  } catch {
    return errorResponse('Error al conectar con la API', 500);
  }
}
