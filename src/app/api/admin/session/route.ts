import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth/session';

export async function GET(request: Request) {
  const cookieHeader = request.headers.get('cookie');
  const valid = await verifySession(cookieHeader);
  return NextResponse.json({ ok: valid });
}
