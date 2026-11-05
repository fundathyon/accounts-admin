import { proxyEmailTemplates } from '../../proxy';

export async function POST(request: Request, { params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  return proxyEmailTemplates(request, `/${encodeURIComponent(templateId)}/preview`, { method: 'POST' });
}
