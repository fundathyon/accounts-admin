import { NextResponse } from 'next/server';

/**
 * Envía un evento de prueba al URL del webhook.
 * La lógica está en el admin (no en la API de accounts).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const url = typeof body.url === 'string' ? body.url.trim() : '';
    const payload = body.payload ?? {};

    if (!url) {
      return NextResponse.json(
        { success: false, error: { message: 'URL del webhook es requerida.' } },
        { status: 400 }
      );
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Event': typeof payload.event === 'string' ? payload.event : 'test',
        'User-Agent': 'Foundathyon-Admin-Test/1.0',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });

    const text = await res.text();
    let responseData: unknown;
    try {
      responseData = text ? JSON.parse(text) : null;
    } catch {
      responseData = text || null;
    }

    return NextResponse.json({
      success: res.ok,
      status: res.status,
      statusText: res.statusText,
      response: responseData,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al enviar el evento de prueba';
    return NextResponse.json(
      { success: false, error: { message } },
      { status: 500 }
    );
  }
}
