import { errorResponse, proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

// The backend pages by 10 by default and caps at 100: an app's behaviors fit in one page of 100.
const LIST_PATH = '/api/v1/app-behaviors';

export async function GET(request: Request) {
    const auth = requireSecretKey(request);
    if (auth.error) return auth.error;

    return proxyToAccounts(`${LIST_PATH}?page=0&size=100&offset=0`, {
        headers: {
            'X-API-KEY': auth.key,
            'Accept': 'application/json',
        },
        cache: 'no-store',
    });
}

/** Generic creation: `{ behavior_code, config, is_active, created_by }`; `created_by` must be a UUID. */
export async function POST(request: Request) {
    const auth = requireSecretKey(request);
    if (auth.error) return auth.error;

    try {
        const body = await request.json();
        return await proxyToAccounts(LIST_PATH, {
            method: 'POST',
            headers: {
                'X-API-KEY': auth.key,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify(body),
            cache: 'no-store',
            parse: 'empty-ok',
        });
    } catch {
        return errorResponse('Error al crear el behavior.', 500);
    }
}
