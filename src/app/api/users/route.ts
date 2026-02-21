import { NextResponse } from 'next/server';
import { INTERNAL_API_URL } from '@/lib/utils';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') || '0';
    const size = searchParams.get('size') || '10';

    // Leer Secret API Key del header enviado por el frontend
    const secretApiKey = request.headers.get('X-Secret-API-Key');

    if (!secretApiKey) {
        return NextResponse.json(
            { success: false, error: { message: 'Secret API Key es requerida. Configúrala en Ajustes.' } },
            { status: 401 }
        );
    }

    try {
        const res = await fetch(`${INTERNAL_API_URL}/api/v1/users?page=${page}&size=${size}`, {
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
            { success: false, error: { message: 'Failed to fetch users' } },
            { status: 500 }
        );
    }
}
