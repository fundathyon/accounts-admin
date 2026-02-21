import { NextResponse } from 'next/server';
import { INTERNAL_API_URL } from '@/lib/utils';

/** Devuelve la URL base de la API de accounts para construir el Callback URI (usa INTERNAL_API_URL). */
export async function GET() {
  const base = INTERNAL_API_URL.replace(/\/$/, '');
  return NextResponse.json({ success: true, data: { base_url: base } });
}
