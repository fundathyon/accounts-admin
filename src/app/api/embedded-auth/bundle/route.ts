import { NextResponse } from 'next/server';
import { errorResponse, fetchAccountsText } from '@/lib/accounts-api';

// Reads nothing from the request: never let `next build` freeze an answer.
export const dynamic = 'force-dynamic';

/** Far above the real bundle (~135 KB); anything bigger is not it. */
const MAX_BUNDLE_CHARS = 2 * 1024 * 1024;

/**
 * The Embedded Auth bundle (`{INTERNAL_API_URL}/ui/v1/accounts.js`, public,
 * Pro only) for the admin's live preview. It is fetched server to server and
 * handed to the page as text, which inlines it in a sandboxed iframe: an
 * opaque-origin frame cannot load scripts from localhost or a private network
 * (Local Network Access), and the backend may not even be browser-reachable.
 * Community and older backends answer 404 here → the page shows its static
 * preview instead.
 */
export async function GET() {
  try {
    const res = await fetchAccountsText('/ui/v1/accounts.js', {
      headers: { Accept: 'application/javascript' },
      cache: 'no-store',
    });
    if (!res.ok) {
      return errorResponse('El bundle de Embedded Auth no está disponible.', res.status === 404 ? 404 : 502);
    }
    if (!res.contentType.includes('javascript') || res.text.length > MAX_BUNDLE_CHARS) {
      return errorResponse('Respuesta inesperada al pedir el bundle de Embedded Auth.', 502);
    }
    return NextResponse.json({ success: true, data: { script: res.text } });
  } catch {
    return errorResponse('Error al pedir el bundle de Embedded Auth.', 500);
  }
}
