import { errorResponse, proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

/**
 * Proxies API key generation to accounts API.
 * POST body: { name, description? } — app_id comes from the secret key.
 * Requires X-Secret-API-Key (forwarded as X-API-KEY to accounts).
 */
export async function POST(request: Request) {
  const auth = requireSecretKey(request, 'Secret API Key es requerida (X-Secret-API-Key).');
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const { name, description } = body as { name?: string; description?: string };
    const payload: Record<string, string> = { name: name ?? '' };
    if (description != null && String(description).trim() !== '') {
      payload.description = String(description).trim();
    }

    return proxyToAccounts('/api/v1/api-keys/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-API-KEY': auth.key,
      },
      body: JSON.stringify(payload),
      errorMessage: 'Error al conectar con la API',
    });
  } catch {
    return errorResponse('Error al conectar con la API', 500);
  }
}
