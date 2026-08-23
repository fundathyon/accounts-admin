import { errorResponse, proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

export async function GET(request: Request) {
    const auth = requireSecretKey(request);
    if (auth.error) return auth.error;

    return proxyToAccounts('/api/v1/webhooks', {
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
        return await proxyToAccounts('/api/v1/webhooks', {
            method: 'POST',
            headers: {
                'X-API-KEY': auth.key,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify(body),
            errorMessage: 'Error al crear el webhook.',
        });
    } catch {
        return errorResponse('Error al crear el webhook.', 500);
    }
}
