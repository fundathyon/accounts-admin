import { NextRequest } from 'next/server';
import { errorResponse, proxyToAccounts, requireAdminKey } from '@/lib/accounts-api';

export async function POST(request: NextRequest) {
  const auth = requireAdminKey('ADMIN_API_KEY no está configurada.');
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    return proxyToAccounts('/api/v1/system/email-templates/preview', {
      method: 'POST',
      headers: {
        'X-Admin-API-Key': auth.key,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch {
    return errorResponse('Error al conectar con el servidor.', 500);
  }
}
