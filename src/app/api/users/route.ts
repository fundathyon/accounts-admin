import { NextResponse } from 'next/server';
import { INTERNAL_API_URL } from '@/lib/utils';

const UPSTREAM_PAGE_SIZE = 100;
const MAX_PAGES = 100;

export async function GET(request: Request) {
    const secretApiKey = request.headers.get('X-Secret-API-Key');

    if (!secretApiKey) {
        return NextResponse.json(
            { success: false, error: { message: 'Secret API Key es requerida. Configúrala en Ajustes.' } },
            { status: 401 }
        );
    }

    try {
        const aggregated: unknown[] = [];
        let lastTotal: number | null = null;

        for (let page = 0; page < MAX_PAGES; page++) {
            const res = await fetch(
                `${INTERNAL_API_URL}/api/v1/users?page=${page}&size=${UPSTREAM_PAGE_SIZE}`,
                {
                    headers: {
                        'X-API-KEY': secretApiKey,
                        Accept: 'application/json',
                    },
                    cache: 'no-store',
                }
            );

            const json = await res.json();
            if (!res.ok || json?.success === false) {
                return NextResponse.json(json, { status: res.status });
            }

            const pageData: unknown[] = Array.isArray(json?.data) ? json.data : [];
            aggregated.push(...pageData);

            const pagination = json?.meta?.pagination;
            const totalPages: unknown = pagination?.totalPages;
            if (typeof pagination?.total === 'number') lastTotal = pagination.total;

            const reachedLast =
                typeof totalPages === 'number'
                    ? page + 1 >= totalPages
                    : pageData.length < UPSTREAM_PAGE_SIZE;
            if (reachedLast) break;
        }

        return NextResponse.json({
            success: true,
            status_code: 200,
            data: aggregated,
            meta: {
                aggregated: true,
                count: aggregated.length,
                upstream_total: lastTotal,
            },
        });
    } catch {
        return NextResponse.json(
            { success: false, error: { message: 'Failed to fetch users' } },
            { status: 500 }
        );
    }
}
