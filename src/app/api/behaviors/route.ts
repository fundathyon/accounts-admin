import { proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

export async function GET(request: Request) {
    const auth = requireSecretKey(request);
    if (auth.error) return auth.error;

    return proxyToAccounts('/api/v1/app-behaviors', {
        headers: {
            'X-API-KEY': auth.key,
            'Accept': 'application/json',
        },
        cache: 'no-store',
    });
}
