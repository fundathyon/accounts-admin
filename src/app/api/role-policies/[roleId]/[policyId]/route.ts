import { proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

type Props = { params: Promise<{ roleId: string; policyId: string }> };

export async function DELETE(request: Request, props: Props) {
  const auth = requireSecretKey(request);
  if (auth.error) return auth.error;

  const { roleId, policyId } = await props.params;
  return proxyToAccounts(`/api/v1/role_policies/${encodeURIComponent(roleId)}/${encodeURIComponent(policyId)}`, {
    method: 'DELETE',
    headers: {
      'X-API-KEY': auth.key,
      Accept: 'application/json',
    },
    cache: 'no-store',
    parse: 'empty-ok',
    errorMessage: 'Error al quitar la política del rol.',
  });
}
