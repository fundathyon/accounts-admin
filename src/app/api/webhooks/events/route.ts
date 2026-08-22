import { proxyToAccounts } from '@/lib/accounts-api';

export async function GET() {
    return proxyToAccounts('/api/v1/webhooks/events', {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store',
        errorMessage: 'Error al obtener los eventos.',
    });
}
