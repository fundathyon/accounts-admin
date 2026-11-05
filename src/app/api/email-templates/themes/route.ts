import { proxyEmailTemplates } from '../proxy';

export async function GET(request: Request) {
  return proxyEmailTemplates(request, '/themes');
}
