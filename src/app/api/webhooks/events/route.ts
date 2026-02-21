import { NextResponse } from 'next/server';
import { INTERNAL_API_URL } from '@/lib/utils';

export async function GET() {
    try {
        const res = await fetch(`${INTERNAL_API_URL}/api/v1/webhooks/events`, {
            headers: { 'Accept': 'application/json' },
            cache: 'no-store',
        });
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch {
        return NextResponse.json(
            { success: false, error: { message: 'Error al obtener los eventos.' } },
            { status: 500 }
        );
    }
}
