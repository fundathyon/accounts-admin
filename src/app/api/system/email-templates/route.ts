import { proxyToAccounts, requireAdminKey } from '@/lib/accounts-api';

export async function GET() {
  const auth = requireAdminKey('ADMIN_API_KEY no está configurada.');
  if (auth.error) return auth.error;

  return proxyToAccounts('/api/v1/system/email-templates', {
    headers: {
      'X-Admin-API-Key': auth.key,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
}
