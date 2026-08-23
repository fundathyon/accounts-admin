import { NextResponse } from 'next/server';
import { ADMIN_API_KEY, INTERNAL_API_URL } from '@/lib/utils';

/**
 * Shared proxy layer for every Next.js API route that forwards to the accounts
 * backend (INTERNAL_API_URL). Routes vary a lot in auth scheme, error message
 * text, cache policy and response parsing — this module only removes the
 * repeated fetch/try-catch/envelope boilerplate; every route-specific quirk
 * stays an explicit parameter at the call site instead of being normalized.
 */

export function errorResponse(message: string, status: number) {
  return NextResponse.json({ success: false, error: { message } }, { status });
}

type AuthResult = { key: string; error?: undefined } | { key?: undefined; error: NextResponse };

/** `X-Secret-API-Key` (incoming) → forwarded to the backend as `X-API-KEY`. */
export function requireSecretKey(
  request: Request,
  message = 'Secret API Key es requerida.'
): AuthResult {
  const key = request.headers.get('X-Secret-API-Key');
  if (!key) return { error: errorResponse(message, 401) };
  return { key };
}

/** `X-Publishable-API-Key` (incoming, with optional fallback header) → forwarded as `X-API-Key`. */
export function requirePublishableKey(
  request: Request,
  message = 'Publishable API Key es requerida. Configúrala en Ajustes.',
  fallbackHeader?: string
): AuthResult {
  const key = request.headers.get('X-Publishable-API-Key') ?? (fallbackHeader ? request.headers.get(fallbackHeader) : null);
  if (!key) return { error: errorResponse(message, 401) };
  return { key };
}

/** Server-side `ADMIN_API_KEY` env var → forwarded as `X-Admin-API-Key`. Missing config is a 500, not a 401. */
export function requireAdminKey(
  message = 'ADMIN_API_KEY no está configurada en el servidor.'
): AuthResult {
  if (!ADMIN_API_KEY) return { error: errorResponse(message, 500) };
  return { key: ADMIN_API_KEY };
}

interface ProxyInit extends Omit<RequestInit, 'body'> {
  body?: BodyInit;
  /** Message returned in the `{success:false,error:{message}}` envelope on network failure. */
  errorMessage?: string;
  /**
   * Response body parsing strategy:
   * - 'json' (default): `res.json()` unconditionally — matches almost every route today.
   * - 'json-safe': read as text first, `JSON.parse` only if non-empty (avoids a crash on an empty body).
   * - 'empty-ok': treat a 204 as an empty body, otherwise `res.json().catch(() => ({}))`.
   */
  parse?: 'json' | 'json-safe' | 'empty-ok';
}

/** Proxies one request to `${INTERNAL_API_URL}${path}` and wraps it as a NextResponse. */
export async function proxyToAccounts(path: string, init: ProxyInit = {}): Promise<NextResponse> {
  const { errorMessage = 'Error al conectar con el servidor.', parse = 'json', ...fetchInit } = init;
  try {
    const res = await fetch(`${INTERNAL_API_URL}${path}`, fetchInit);

    if (parse === 'empty-ok' && res.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    let data: unknown;
    if (parse === 'json-safe') {
      const text = await res.text();
      data = text ? JSON.parse(text) : {};
    } else if (parse === 'empty-ok') {
      data = await res.json().catch(() => ({}));
    } else {
      data = await res.json();
    }

    return NextResponse.json(data, { status: res.status });
  } catch {
    return errorResponse(errorMessage, 500);
  }
}

/** Same as proxyToAccounts but returns the parsed body directly instead of a NextResponse — for routes that make several backend calls themselves (e.g. paginated aggregation) and build their own response. */
export async function fetchAccountsJson(path: string, init: RequestInit = {}): Promise<{ status: number; ok: boolean; data: unknown }> {
  const res = await fetch(`${INTERNAL_API_URL}${path}`, init);
  const data = await res.json();
  return { status: res.status, ok: res.ok, data };
}
