import { NextResponse } from 'next/server';
import { INTERNAL_API_URL } from '@/lib/utils';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') || '0';
    const size = searchParams.get('size') || '10';
    const offset = searchParams.get('offset') || '0';

    try {
        const res = await fetch(`${INTERNAL_API_URL}/v1/apps?page=${page}&size=${size}&offset=${offset}`, {
            headers: {
                'X-Admin-API-Key': 'secret',
                'Accept': 'application/json',
            },
            cache: 'no-store',
        });

        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (error) {
        return NextResponse.json({ success: false, error: { message: 'Failed to fetch apps' } }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const res = await fetch(`${INTERNAL_API_URL}/v1/apps`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (error) {
        return NextResponse.json({ success: false, error: { message: 'Failed to create app' } }, { status: 500 });
    }
}
