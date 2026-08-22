import { NextResponse } from 'next/server';
import { errorResponse, fetchAccountsJson, requireSecretKey } from '@/lib/accounts-api';

const UPSTREAM_PAGE_SIZE = 100;
const MAX_PAGES = 100;

export async function GET(request: Request) {
    const auth = requireSecretKey(request, 'Secret API Key es requerida. Configúrala en Ajustes.');
    if (auth.error) return auth.error;

    try {
        const aggregated: unknown[] = [];
        let lastTotal: number | null = null;

        for (let page = 0; page < MAX_PAGES; page++) {
            const { status, ok, data } = await fetchAccountsJson(
                `/api/v1/users?page=${page}&size=${UPSTREAM_PAGE_SIZE}`,
                {
                    headers: {
                        'X-API-KEY': auth.key,
                        Accept: 'application/json',
                    },
                    cache: 'no-store',
                }
            );

            const json = data as any;
            if (!ok || json?.success === false) {
                return NextResponse.json(json, { status });
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
        return errorResponse('Failed to fetch users', 500);
    }
}
