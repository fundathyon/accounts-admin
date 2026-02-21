/**
 * Admin session: signed cookie with timestamp.
 * SESSION_TTL env = segundos de duración (default: 86400 = 1 día).
 * Uses Web Crypto for Edge compatibility (middleware).
 */

const COOKIE_NAME = 'admin_session';

function getSessionTtlMs(): number {
  const raw = process.env.SESSION_TTL;
  if (!raw) return 24 * 60 * 60 * 1000; // 1 día por defecto
  const sec = parseInt(raw, 10);
  if (Number.isNaN(sec) || sec <= 0) return 24 * 60 * 60 * 1000;
  return sec * 1000;
}

function getSecret(): string {
  const secret =
    process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD ?? 'change-me-in-production';
  return secret;
}

async function sign(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(data)
  );
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function verify(secret: string, data: string, signature: string): Promise<boolean> {
  const expected = await sign(secret, data);
  if (signature.length !== expected.length) return false;
  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return result === 0;
}

export function getSessionCookieHeader(): string {
  return COOKIE_NAME;
}

function base64urlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(b64: string): string {
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export async function createSessionCookie(): Promise<string> {
  const ttlMs = getSessionTtlMs();
  const timestamp = Date.now().toString();
  const secret = getSecret();
  const signature = await sign(secret, timestamp);
  const value = `${timestamp}.${signature}`;
  const encoded = base64urlEncode(value);
  const maxAge = Math.floor(ttlMs / 1000);
  return `${COOKIE_NAME}=${encoded}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export async function verifySession(cookieHeader: string | null): Promise<boolean> {
  if (!cookieHeader) return false;
  const cookies = cookieHeader.split(';').map((c) => c.trim());
  let raw = '';
  for (const c of cookies) {
    if (c.startsWith(`${COOKIE_NAME}=`)) {
      raw = c.slice(COOKIE_NAME.length + 1).trim();
      break;
    }
  }
  if (!raw) return false;
  let value: string;
  try {
    value = base64urlDecode(raw);
  } catch {
    return false;
  }
  const dot = value.indexOf('.');
  if (dot === -1) return false;
  const timestamp = value.slice(0, dot);
  const signature = value.slice(dot + 1);
  const ts = parseInt(timestamp, 10);
  if (Number.isNaN(ts)) return false;
  const ttlMs = getSessionTtlMs();
  if (Date.now() - ts > ttlMs) return false;
  const secret = getSecret();
  return verify(secret, timestamp, signature);
}
