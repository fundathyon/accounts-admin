import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth/session';

export async function GET(request: Request) {
  const cookieHeader = request.headers.get('cookie');
  const valid = await verifySession(cookieHeader);
  if (!valid) return NextResponse.json({ ok: false });
  const user = process.env.ADMIN_USER ?? 'admin';
  return NextResponse.json({ ok: true, user });
}
