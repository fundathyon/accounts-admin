'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Puzzle, Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAdmin } from '@/context/admin-context';
import { BASE_PATH } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmailAuthConfigView, type EmailAuthConfig } from '@/components/behaviors/email-auth-config-view';
import { cn } from '@/lib/utils';
import type { AppBehaviorDetail } from '@/lib/admin-types';

export default function BehaviorDetailPage() {
  const params = useParams();
  const { apiUrl, showNotification, savedSecretKey } = useAdmin();
  const [behavior, setBehavior] = useState<AppBehaviorDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const id = params.id as string;
  const behaviorsHref = `${BASE_PATH}/behaviors`.replace(/\/+/g, '/') || '/behaviors';
  const [toggling, setToggling] = useState(false);

  const loadBehavior = useCallback(async () => {
    if (!savedSecretKey) return;
    try {
      const res = await fetch(apiUrl(`/api/behaviors/${id}`), {
        headers: { 'X-Secret-API-Key': savedSecretKey },
      });
      const data = await res.json();
      if (data.success) setBehavior(data.data);
      else showNotification(data.error?.message || 'Error al cargar detalles', 'error');
    } catch {
      showNotification('Error al cargar detalles', 'error');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, id, savedSecretKey, showNotification]);

  const toggleEmailVerification = async () => {
    if (!savedSecretKey || behavior?.behavior_code !== 'email_auth') return;
    const emailConfig = behavior.config as { verification?: { enabled?: boolean } };
    const isEnabled = emailConfig?.verification?.enabled ?? false;
    const endpoint = isEnabled ? '/api/behaviors/email/verification/deactivate' : '/api/behaviors/email/verification/activate';
    setToggling(true);
    try {
      const res = await fetch(apiUrl(endpoint), {
        method: 'POST',
        headers: {
          'X-Secret-API-Key': savedSecretKey,
          ...(!isEnabled && { 'Content-Type': 'application/json' }),
        },
        ...(!isEnabled && { body: JSON.stringify({}) }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification(isEnabled ? 'Verificación de email desactivada' : 'Verificación de email activada', 'success');
        await loadBehavior();
      } else {
        showNotification(data.error?.message || 'Error al actualizar', 'error');
      }
    } catch {
      showNotification('Error al contactar el servidor', 'error');
    } finally {
      setToggling(false);
    }
  };

  useEffect(() => {
    if (!savedSecretKey) {
      setLoading(false);
      return;
    }
    setLoading(true);
    loadBehavior();
  }, [id, savedSecretKey, loadBehavior]);

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!behavior) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild className="mb-6 gap-2 -ml-2">
          <Link href={behaviorsHref}>
            <ChevronLeft className="w-4 h-4" /> Volver a behaviors
          </Link>
        </Button>
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">Behavior no encontrado</p>
        </Card>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Button variant="ghost" asChild className="mb-6 gap-2 -ml-2">
        <Link href={behaviorsHref}>
          <ChevronLeft className="w-4 h-4" /> Volver a behaviors
        </Link>
      </Button>

      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-400">
            <Puzzle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{behavior.behavior_code}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge
                variant={behavior.is_active ? 'secondary' : 'outline'}
                className={cn(
                  behavior.is_active ? 'bg-emerald-500/10 text-emerald-400 border-0' : 'bg-muted text-muted-foreground'
                )}
              >
                {behavior.is_active ? 'Activo' : 'Inactivo'}
              </Badge>
              <span className="text-xs text-muted-foreground font-mono">{behavior.id}</span>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
            <Settings className="w-4 h-4" />
            {behavior.behavior_code === 'email_auth' ? 'Configuración' : 'Configuración JSON'}
          </h3>
          {behavior.behavior_code === 'email_auth' ? (
            <EmailAuthConfigView
              config={behavior.config as EmailAuthConfig}
              onToggleVerification={toggleEmailVerification}
              togglingVerification={toggling}
            />
          ) : (
            <div className="bg-muted/50 rounded-2xl p-4 border font-mono text-sm overflow-x-auto">
              <pre className="text-sky-300">{JSON.stringify(behavior.config, null, 2)}</pre>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground font-medium uppercase">Creado por</div>
            <div className="text-sm font-mono">{behavior.created_by}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground font-medium uppercase">App ID</div>
            <div className="text-sm font-mono">{behavior.app_id}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground font-medium uppercase">Fecha de creación</div>
            <div className="text-sm">{new Date(behavior.created_at).toLocaleString()}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground font-medium uppercase">Última actualización</div>
            <div className="text-sm">{new Date(behavior.updated_at).toLocaleString()}</div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
