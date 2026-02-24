import { NextRequest, NextResponse } from 'next/server';
import { INTERNAL_API_URL } from '@/lib/utils';

// PATCH - Update a role by ID
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const secretApiKey = request.headers.get('X-Secret-API-Key');
    const { id } = await params;

    if (!secretApiKey) {
        return NextResponse.json(
            { success: false, error: { message: 'Secret API Key es requerida.' } },
            { status: 401 }
        );
    }

    if (!id) {
        return NextResponse.json(
            { success: false, error: { message: 'ID del rol es requerido.' } },
            { status: 400 }
        );
    }

    try {
        const body = await request.json();
        const res = await fetch(`${INTERNAL_API_URL}/api/v1/roles/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: {
                'X-API-KEY': secretApiKey,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch {
        return NextResponse.json(
            { success: false, error: { message: 'Error al actualizar el rol.' } },
            { status: 500 }
        );
    }
}

// DELETE - Remove a role by ID
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const secretApiKey = request.headers.get('X-Secret-API-Key');
    const { id } = await params;

    if (!secretApiKey) {
        return NextResponse.json(
            { success: false, error: { message: 'Secret API Key es requerida.' } },
            { status: 401 }
        );
    }

    if (!id) {
        return NextResponse.json(
            { success: false, error: { message: 'ID del rol es requerido.' } },
            { status: 400 }
        );
    }

    try {
        const res = await fetch(`${INTERNAL_API_URL}/api/v1/roles/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: {
                'X-API-KEY': secretApiKey,
                Accept: 'application/json',
            },
        });
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch {
        return NextResponse.json(
            { success: false, error: { message: 'Error al eliminar el rol.' } },
            { status: 500 }
        );
    }
}
