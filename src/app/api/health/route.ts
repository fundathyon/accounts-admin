import { proxyToAccounts } from '@/lib/accounts-api';

// Reads nothing from the request: without this, `next build` could freeze the
// first answer. The edition must be asked to the running backend.
export const dynamic = 'force-dynamic';

/**
 * Public `GET {INTERNAL_API_URL}/health` (no API key). The admin only reads
 * `data.edition` from it to show or hide Pro-only screens (Embedded Auth).
 */
export async function GET() {
  return proxyToAccounts('/health', {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    parse: 'json-safe',
    errorMessage: 'Error al consultar /health.',
  });
}
