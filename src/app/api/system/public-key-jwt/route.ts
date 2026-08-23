import { proxyToAccounts, requireAdminKey } from '@/lib/accounts-api';

/**
 * GET /api/system/public-key-jwt
 * Proxy to accounts API. Exposes PUBLIC_KEY_JWT:
 * - Community: uses ADMIN_API_KEY from env
 * - Pro: requires X-Secret-API-Key to identify the app
 */
export async function GET(request: Request) {
    const auth = requireAdminKey();
    if (auth.error) return auth.error;

    const secretKey = request.headers.get('X-Secret-API-Key');

    const headers: Record<string, string> = {
        'X-Admin-API-Key': auth.key,
        'Accept': 'application/json',
    };
    if (secretKey) {
        headers['X-API-KEY'] = secretKey;
    }

    return proxyToAccounts('/api/v1/system/public-key-jwt', { headers, cache: 'no-store' });
}
