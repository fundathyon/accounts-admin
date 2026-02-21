import { NextResponse } from 'next/server';
import { INTERNAL_API_URL } from '@/lib/utils';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const secretKey = request.headers.get('X-Secret-API-Key');
    const id = params.id;

    if (!secretKey) {
        return NextResponse.json(
            { success: false, error: { message: 'Secret API Key es requerida.' } },
            { status: 401 }
        );
    }

    try {
        const res = await fetch(`${INTERNAL_API_URL}/api/v1/app-behaviors/${id}`, {
            headers: {
                'X-API-KEY': secretKey,
                'Accept': 'application/json',
            },
            cache: 'no-store',
        });
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch {
        return NextResponse.json(
            { success: false, error: { message: 'Error al conectar con el servidor.' } },
            { status: 500 }
        );
    }
}
