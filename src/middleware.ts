import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession } from '@/lib/auth/session';

const BASE_PATH = process.env.BASE_PATH || process.env.NEXT_PUBLIC_BASE_PATH || '';

function getPathname(pathname: string): string {
  if (!BASE_PATH || pathname === BASE_PATH) return pathname === BASE_PATH ? '/' : pathname;
  if (pathname.startsWith(BASE_PATH + '/')) {
    return pathname.slice(BASE_PATH.length) || '/';
  }
  return pathname;
}

export async function middleware(request: NextRequest) {
  const pathname = getPathname(request.nextUrl.pathname);

  // Allow login page and admin auth API
  if (
    pathname === '/login' ||
    pathname.startsWith('/api/admin/login') ||
    pathname.startsWith('/api/admin/logout') ||
    pathname.startsWith('/api/admin/session')
  ) {
    return NextResponse.next();
  }

  // Migración OAuth legacy: el BFF reenvía con X-API-KEY; la autorización real es la Secret Key.
  // Sin esta excepción, un 302 al login devolvía HTML y el cliente no parseaba JSON (sin aviso).
  if (pathname.startsWith('/api/oauth-configs/migration/')) {
    return NextResponse.next();
  }

  // Allow static assets and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const valid = await verifySession(request.headers.get('cookie'));
  if (!valid) {
    const loginPath = `${BASE_PATH}/login`.replace(/\/+/g, '/') || '/login';
    const loginUrl = new URL(loginPath, request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
