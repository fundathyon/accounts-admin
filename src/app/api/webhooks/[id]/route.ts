import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireSecretKey(request);
  const { id } = await params;

  if (auth.error) return auth.error;

  if (!id) {
    return NextResponse.json(
      { success: false, error: { message: 'ID del webhook es requerido.' } },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    return await proxyToAccounts(`/api/v1/webhooks/${id}`, {
      method: 'PATCH',
      headers: {
        'X-API-KEY': auth.key,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      errorMessage: 'Error al actualizar el webhook.',
    });
  } catch {
    return errorResponse('Error al actualizar el webhook.', 500);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireSecretKey(_request);
  const { id } = await params;

  if (auth.error) return auth.error;

  if (!id) {
    return NextResponse.json(
      { success: false, error: { message: 'ID del webhook es requerido.' } },
      { status: 400 }
    );
  }

  return proxyToAccounts(`/api/v1/webhooks/${id}`, {
    method: 'DELETE',
    headers: {
      'X-API-KEY': auth.key,
      Accept: 'application/json',
    },
    errorMessage: 'Error al eliminar el webhook.',
  });
}
