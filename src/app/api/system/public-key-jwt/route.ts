import { NextResponse } from 'next/server';
import { INTERNAL_API_URL, ADMIN_API_KEY } from '@/lib/utils';

/**
 * GET /api/system/public-key-jwt
 * Proxy to accounts API. Exposes PUBLIC_KEY_JWT:
 * - Community: uses ADMIN_API_KEY from env
 * - Pro: requires X-Secret-API-Key to identify the app
 */
export async function GET(request: Request) {
    if (!ADMIN_API_KEY) {
        return NextResponse.json(
            { success: false, error: { message: 'ADMIN_API_KEY no está configurada en el servidor.' } },
            { status: 500 }
        );
    }

    const secretKey = request.headers.get('X-Secret-API-Key');

    const url = `${INTERNAL_API_URL}/api/v1/system/public-key-jwt`;
    const headers: Record<string, string> = {
        'X-Admin-API-Key': ADMIN_API_KEY,
        'Accept': 'application/json',
    };
    if (secretKey) {
        headers['X-API-KEY'] = secretKey;
    }

    try {
        const res = await fetch(url, { headers, cache: 'no-store' });
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch {
        return NextResponse.json(
            { success: false, error: { message: 'Error al conectar con el servidor.' } },
            { status: 500 }
        );
    }
}
