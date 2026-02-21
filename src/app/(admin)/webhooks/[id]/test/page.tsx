'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Zap, FileJson, Loader2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAdmin } from '@/context/admin-context';
import { BASE_PATH } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { JsonEditor } from '@/components/json-editor';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { WebhookItem, WebhookEvent } from '@/lib/admin-types';

const COMMON_EVENTS: WebhookEvent[] = [
  { code: 'accounts.user.signup', description: 'Se dispara cuando un usuario se registra', category: 'Comunes' },
  { code: 'accounts.user.deleted', description: 'Se dispara cuando se elimina un usuario', category: 'Comunes' },
];

function getDefaultTestPayload(code: string): object {
  const ts = new Date().toISOString();
  if (code === 'accounts.user.signup') {
    return {
      id: 'evt_a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      specversion: '1.0',
      type: 'accounts.user.signup',
      version: '1.0.0',
      source: 'accounts-service',
      created_at: ts,
      processed_at: new Date(Date.now() + 1500).toISOString(),
      triggered_by: {
        ip: '189.203.45.12',
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      app_id: 'app_jalo-core',
      data: {
        user: {
          id: 'usr_f47ac10b-58cc-4372-a567-0e02b2c3d479',
          name: 'Carlos López',
          email: 'carlos.lopez@example.com',
        },
        auth: {
          id: 'auth_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
          method: 'email_password',
          is_verify: true,
        },
        roles: ['user'],
      },
      context: {
        environment: 'development',
        trace_id: 'trace_7c9e6679-7425-40de-944b-e07fc1f90ae7',
      },
    };
  }
  if (code === 'accounts.user.deleted') {
    return {
      id: 'evt_b2c3d4e5-f6a7-8901-bcde-f23456789012',
      specversion: '1.0',
      type: 'accounts.user.deleted',
      version: '1.0.0',
      source: 'accounts-service',
      created_at: ts,
      processed_at: new Date(Date.now() + 1500).toISOString(),
      triggered_by: {
        ip: '189.203.45.12',
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      app_id: 'app_jalo-core',
      data: {
        user: {
          id: 'usr_f47ac10b-58cc-4372-a567-0e02b2c3d479',
          name: 'Carlos López',
          email: 'carlos.lopez@example.com',
        },
      },
      context: {
        environment: 'development',
        trace_id: 'trace_8d0f7780-8536-51ef-a55c-f18gd2g01bf8',
      },
    };
  }
  return { event: code, timestamp: ts, data: {} };
}

export default function WebhookTestPage() {
  const params = useParams();
  const { apiUrl, showNotification, savedSecretKey } = useAdmin();
  const id = params.id as string;
  const [webhook, setWebhook] = useState<WebhookItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [testEventPayload, setTestEventPayload] = useState('');
  const [testEventSelectedEvent, setTestEventSelectedEvent] = useState('');
  const [testEventSending, setTestEventSending] = useState(false);

  const webhooksHref = `${BASE_PATH}/webhooks`.replace(/\/+/g, '/') || '/webhooks';

  useEffect(() => {
    if (!savedSecretKey || !id) {
      setLoading(false);
      return;
    }
    const fetchWebhook = async () => {
      try {
        const res = await fetch(apiUrl('/api/webhooks'), {
          headers: { 'X-Secret-API-Key': savedSecretKey },
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          const found = data.data.find((w: WebhookItem) => w.id === id);
          if (found) {
            setWebhook(found);
            const firstEvent = COMMON_EVENTS[0]?.code ?? '';
            setTestEventSelectedEvent(firstEvent);
            setTestEventPayload(JSON.stringify(getDefaultTestPayload(firstEvent), null, 2));
          }
        }
      } catch {
        showNotification('Error al cargar el webhook', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchWebhook();
  }, [savedSecretKey, id, apiUrl, showNotification]);

  const selectTestEvent = (code: string) => {
    setTestEventSelectedEvent(code);
    setTestEventPayload(JSON.stringify(getDefaultTestPayload(code), null, 2));
  };

  const sendTestEvent = async () => {
    if (!webhook) return;
    let payload: object;
    try {
      payload = JSON.parse(testEventPayload) as object;
    } catch {
      showNotification('JSON inválido. Corrige el formato del payload.', 'error');
      return;
    }
    setTestEventSending(true);
    try {
      const res = await fetch(apiUrl('/api/webhooks/test'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhook.url, payload }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification('Evento de prueba enviado correctamente', 'success');
      } else {
        showNotification(data.error?.message ?? `Error ${data.status ?? ''}: ${data.statusText ?? 'No se pudo enviar'}`, 'error');
      }
    } catch {
      showNotification('Error de conexión al enviar el evento de prueba', 'error');
    } finally {
      setTestEventSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Cargando webhook…</p>
      </div>
    );
  }

  if (!webhook) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild className="gap-2">
          <Link href={webhooksHref}>
            <ArrowLeft className="w-4 h-4" /> Volver a Webhooks
          </Link>
        </Button>
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle>Webhook no encontrado</CardTitle>
            <CardDescription>No se encontró el webhook con el ID indicado.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={webhooksHref}>Ir a Webhooks</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild className="gap-2">
          <Link href={webhooksHref}>
            <ArrowLeft className="w-4 h-4" /> Volver a Webhooks
          </Link>
        </Button>
      </div>

      <div className="space-y-6">
        <Collapsible defaultOpen className="rounded-xl border border-input bg-muted/30 group/collapse">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-muted/50 transition-colors rounded-xl"
            >
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-400" />
                <span className="font-medium">Evento de prueba</span>
                <span className="text-xs text-muted-foreground font-mono">
                  {testEventSelectedEvent || 'Seleccionar…'}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]/collapse:rotate-90" />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-3 pt-0 flex flex-col gap-2">
              {COMMON_EVENTS.map((ev) => (
                <button
                  key={ev.code}
                  type="button"
                  onClick={() => selectTestEvent(ev.code)}
                  className={cn(
                    'text-left px-3 py-2 rounded-lg text-xs font-mono transition-colors',
                    testEventSelectedEvent === ev.code
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'bg-background/50 text-muted-foreground hover:bg-muted border border-transparent'
                  )}
                >
                  <div className="font-medium">{ev.code}</div>
                  <div className="text-muted-foreground mt-0.5">{ev.description}</div>
                </button>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FileJson className="w-4 h-4" /> Payload JSON (editable)
            </Label>
            <JsonEditor
              value={testEventPayload}
              onChange={setTestEventPayload}
              minHeight="200px"
              maxHeight="70vh"
            />
          </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" asChild className="flex-1">
            <Link href={webhooksHref}>Cancelar</Link>
          </Button>
          <Button onClick={sendTestEvent} disabled={testEventSending} className="flex-1 gap-2">
            {testEventSending && <Loader2 className="w-4 h-4 animate-spin" />}
            {testEventSending ? 'Enviando…' : 'Enviar evento'}
          </Button>
        </div>
      </div>
    </div>
  );
}
