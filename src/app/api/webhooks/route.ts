import { NextResponse } from 'next/server';
import { INTERNAL_API_URL } from '@/lib/utils';

export async function GET(request: Request) {
    const secretApiKey = request.headers.get('X-Secret-API-Key');

    if (!secretApiKey) {
        return NextResponse.json(
            { success: false, error: { message: 'Secret API Key es requerida.' } },
            { status: 401 }
        );
    }

    try {
        const res = await fetch(`${INTERNAL_API_URL}/api/v1/webhooks`, {
            headers: {
                'X-API-KEY': secretApiKey,
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

export async function POST(request: Request) {
    const secretApiKey = request.headers.get('X-Secret-API-Key');

    if (!secretApiKey) {
        return NextResponse.json(
            { success: false, error: { message: 'Secret API Key es requerida.' } },
            { status: 401 }
        );
    }

    try {
        const body = await request.json();
        const res = await fetch(`${INTERNAL_API_URL}/api/v1/webhooks`, {
            method: 'POST',
            headers: {
                'X-API-KEY': secretApiKey,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch {
        return NextResponse.json(
            { success: false, error: { message: 'Error al crear el webhook.' } },
            { status: 500 }
        );
    }
}
