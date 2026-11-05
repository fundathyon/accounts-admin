import { proxyEmailTemplates } from '../../proxy';

export async function PUT(request: Request) {
  return proxyEmailTemplates(request, '/themes/active', { method: 'PUT' });
}
