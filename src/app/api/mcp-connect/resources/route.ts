import { errorResponse, proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

/**
 * MCP servers of the app. Accounts mounts these routes in both editions, but
 * only with OAUTH_PUBLIC_URL set: without it they answer a plain-text 404,
 * which `empty-ok` keeps as a 404.
 */
const BACKEND_PATH = '/v1/mcp-resources';

export async function GET(request: Request) {
  const auth = requireSecretKey(request);
  if (auth.error) return auth.error;

  return proxyToAccounts(BACKEND_PATH, {
    headers: {
      'X-API-KEY': auth.key,
      Accept: 'application/json',
    },
    cache: 'no-store',
    parse: 'empty-ok',
    errorMessage: 'Error al cargar los servidores MCP.',
  });
}

export async function POST(request: Request) {
  const auth = requireSecretKey(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    return await proxyToAccounts(BACKEND_PATH, {
      method: 'POST',
      headers: {
        'X-API-KEY': auth.key,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      parse: 'empty-ok',
      errorMessage: 'Error al registrar el servidor MCP.',
    });
  } catch {
    return errorResponse('Error al registrar el servidor MCP.', 500);
  }
}
