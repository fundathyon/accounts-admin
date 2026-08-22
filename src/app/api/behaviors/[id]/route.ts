import { errorResponse, proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
    const auth = requireSecretKey(request);
    if (auth.error) return auth.error;

    const params = await props.params;
    const id = params.id;

    return proxyToAccounts(`/api/v1/app-behaviors/${id}`, {
        headers: {
            'X-API-KEY': auth.key,
            'Accept': 'application/json',
        },
        cache: 'no-store',
    });
}

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
    const auth = requireSecretKey(request);
    if (auth.error) return auth.error;

    const params = await props.params;
    const id = params.id;

    try {
        const body = await request.json();
        return proxyToAccounts(`/api/v1/app-behaviors/${id}`, {
            method: 'PUT',
            headers: {
                'X-API-KEY': auth.key,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify(body),
            errorMessage: 'Error al actualizar el behavior.',
        });
    } catch {
        return errorResponse('Error al actualizar el behavior.', 500);
    }
}
