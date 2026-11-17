import { NextResponse } from 'next/server';
import { INTERNAL_API_URL } from '@/lib/utils';
import { resolvePublicBase } from '@/lib/public-base';

/**
 * Browser-facing base of Accounts for the OAuth Callback URI and the Embedded
 * Auth snippet: ACCOUNTS_PUBLIC_URL (see `src/lib/public-base.ts`). Without it,
 * outside a local setup, answers 503 so the UI reports the missing setting
 * instead of building a Callback URI on the internal address.
 */
export async function GET() {
  const base = resolvePublicBase(process.env.ACCOUNTS_PUBLIC_URL, INTERNAL_API_URL);
  if (!base) {
    return NextResponse.json(
      { success: false, error: { message: 'ACCOUNTS_PUBLIC_URL is not configured', code: 'public_url_missing' } },
      { status: 503 },
    );
  }
  return NextResponse.json({ success: true, data: { base_url: base } });
}
