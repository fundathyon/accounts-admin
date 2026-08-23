import { NextRequest } from 'next/server';
import { errorResponse, proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

// PATCH - Update a role by ID
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = requireSecretKey(request);
    if (auth.error) return auth.error;

    const { id } = await params;
    if (!id) {
        return errorResponse('ID del rol es requerido.', 400);
    }

    try {
        const body = await request.json();
        return proxyToAccounts(`/api/v1/roles/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: {
                'X-API-KEY': auth.key,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify(body),
            errorMessage: 'Error al actualizar el rol.',
        });
    } catch {
        return errorResponse('Error al actualizar el rol.', 500);
    }
}

// DELETE - Remove a role by ID
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = requireSecretKey(request);
    if (auth.error) return auth.error;

    const { id } = await params;
    if (!id) {
        return errorResponse('ID del rol es requerido.', 400);
    }

    return proxyToAccounts(`/api/v1/roles/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
            'X-API-KEY': auth.key,
            Accept: 'application/json',
        },
        errorMessage: 'Error al eliminar el rol.',
    });
}
