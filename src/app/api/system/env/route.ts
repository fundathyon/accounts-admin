import { NextResponse } from 'next/server';
import { INTERNAL_API_URL } from '@/lib/utils';

export async function GET(request: Request) {
    const adminApiKey = request.headers.get('X-Admin-API-Key');
    const { searchParams } = new URL(request.url);
    const revealSensitive = searchParams.get('reveal_sensitive') === '1' || searchParams.get('reveal_sensitive') === 'true';

    if (!adminApiKey) {
        return NextResponse.json(
            { success: false, error: { message: 'Admin API Key es requerida.' } },
            { status: 401 }
        );
    }

    const url = new URL(`${INTERNAL_API_URL}/api/v1/system/env`);
    if (revealSensitive) url.searchParams.set('reveal_sensitive', '1');

    try {
        const res = await fetch(url.toString(), {
            headers: {
                'X-Admin-API-Key': adminApiKey,
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
