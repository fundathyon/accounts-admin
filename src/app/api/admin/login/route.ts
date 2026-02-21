import { NextResponse } from 'next/server';
import { createSessionCookie } from '@/lib/auth/session';
import { BASE_PATH } from '@/lib/utils';

function validateCredentials(user: string, password: string): boolean {
  const adminUser = process.env.ADMIN_USER ?? 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'changeme';
  if (!adminUser || !adminPassword) return false;
  return user === adminUser && password === adminPassword;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const user = String(body.user ?? '').trim();
    const password = String(body.password ?? '');
    if (!user || !password) {
      return NextResponse.json(
        { error: 'Usuario y contraseña requeridos' },
        { status: 400 }
      );
    }
    if (!validateCredentials(user, password)) {
      return NextResponse.json(
        { error: 'Usuario o contraseña incorrectos' },
        { status: 401 }
      );
    }
    const cookieHeader = await createSessionCookie();
    const res = NextResponse.json({ ok: true });
    res.headers.set('Set-Cookie', cookieHeader);
    return res;
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
