import { proxyEmailTemplates } from '../proxy';

type Context = { params: Promise<{ templateId: string }> };

const path = async ({ params }: Context) => `/${encodeURIComponent((await params).templateId)}`;

export async function GET(request: Request, context: Context) {
  return proxyEmailTemplates(request, await path(context));
}

export async function PUT(request: Request, context: Context) {
  return proxyEmailTemplates(request, await path(context), { method: 'PUT' });
}

export async function DELETE(request: Request, context: Context) {
  return proxyEmailTemplates(request, await path(context), { method: 'DELETE' });
}
