import { errorResponse, proxyToAccounts, requireAdminKey, requireSecretKey } from '@/lib/accounts-api';

export async function GET(request: Request) {
    const auth = requireAdminKey();
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') || '0';
    const size = searchParams.get('size') || '10';
    const offset = searchParams.get('offset') || '0';

    return proxyToAccounts(`/v1/apps?page=${page}&size=${size}&offset=${offset}`, {
        headers: {
            'X-Admin-API-Key': auth.key,
            'Accept': 'application/json',
        },
        cache: 'no-store',
        errorMessage: 'Failed to fetch apps',
    });
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        return await proxyToAccounts('/v1/apps', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify(body),
            errorMessage: 'Failed to create app',
        });
    } catch {
        return errorResponse('Failed to create app', 500);
    }
}

export async function PATCH(request: Request) {
    const auth = requireSecretKey(request);
    if (auth.error) return auth.error;

    try {
        const body = await request.json();
        return await proxyToAccounts('/api/v1/apps', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': auth.key,
            },
            body: JSON.stringify(body),
            errorMessage: 'Failed to update app',
        });
    } catch {
        return errorResponse('Failed to update app', 500);
    }
}
