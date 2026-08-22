import { INTERNAL_API_URL } from '@/lib/utils';
import { proxyToAccounts, requireAdminKey } from '@/lib/accounts-api';

export async function GET(request: Request) {
    const auth = requireAdminKey('ADMIN_API_KEY no está configurada en el servidor.');
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const revealSensitive = searchParams.get('reveal_sensitive') === '1' || searchParams.get('reveal_sensitive') === 'true';

    const url = new URL(`${INTERNAL_API_URL}/api/v1/system/env`);
    if (revealSensitive) url.searchParams.set('reveal_sensitive', '1');

    return proxyToAccounts(url.toString().replace(INTERNAL_API_URL, ''), {
        headers: {
            'X-Admin-API-Key': auth.key,
            'Accept': 'application/json',
        },
        cache: 'no-store',
    });
}
