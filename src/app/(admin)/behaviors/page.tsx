'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Puzzle, Key, ShieldCheck, Settings, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAdmin } from '@/context/admin-context';
import { BASE_PATH } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AppBehavior, AppBehaviorDetail } from '@/lib/admin-types';

function truncateKey(key: string) {
  if (!key || key.length <= 20) return key;
  return key.slice(0, 12) + '••••••••••••' + key.slice(-8);
}

export default function BehaviorsPage() {
  const { apiUrl, showNotification, savedSecretKey } = useAdmin();
  const [behaviors, setBehaviors] = useState<AppBehavior[]>([]);
  const [selectedBehavior, setSelectedBehavior] = useState<AppBehaviorDetail | null>(null);
  const [isBehaviorModalOpen, setIsBehaviorModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const settingsHref = `${BASE_PATH}/settings`.replace(/\/+/g, '/') || '/settings';

  const fetchBehaviors = async () => {
    if (!savedSecretKey) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/behaviors'), { headers: { 'X-Secret-API-Key': savedSecretKey } });
      const data = await res.json();
      if (data.success) setBehaviors(data.data || []);
      else showNotification(data.error?.message || 'Error al cargar behaviors', 'error');
    } catch {
      showNotification('Error de conexión con la API de Behaviors', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchBehaviorDetails = async (id: string) => {
    if (!savedSecretKey) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/behaviors/${id}`), { headers: { 'X-Secret-API-Key': savedSecretKey } });
      const data = await res.json();
      if (data.success) {
        setSelectedBehavior(data.data);
        setIsBehaviorModalOpen(true);
      } else showNotification(data.error?.message || 'Error al cargar detalles', 'error');
    } catch {
      showNotification('Error al contactar el servidor', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBehaviors();
  }, [savedSecretKey]);

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Behaviors</h1>
            <p className="text-muted-foreground text-sm mt-1">Comportamientos activos en tu aplicación.</p>
          </div>
          {!savedSecretKey && (
            <Button variant="outline" asChild className="gap-2 border-amber-500/20 text-amber-500 hover:bg-amber-500/10">
              <Link href={settingsHref}>
                <Key className="w-4 h-4" /> Configura tu Secret API Key
              </Link>
            </Button>
          )}
        </div>

        {!savedSecretKey ? (
          <Card className="border-amber-500/20 p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
              <Key className="w-8 h-8 text-amber-400" />
            </div>
            <CardTitle className="text-amber-300 mb-2">Secret API Key Requerida</CardTitle>
            <CardDescription className="mb-6">Necesitas configurar la Secret API Key en Configuración para ver los behaviors.</CardDescription>
            <Button asChild>
              <Link href={settingsHref}>Ir a Configuración</Link>
            </Button>
          </Card>
        ) : loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="px-6 py-3 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-center gap-2 text-xs text-emerald-400">
              <ShieldCheck className="w-4 h-4" /> Consultando con: <span className="font-mono">{truncateKey(savedSecretKey)}</span>
            </div>

            {behaviors.length === 0 ? (
              <Card className="border-dashed p-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center mx-auto mb-4">
                  <Puzzle className="w-8 h-8 text-rose-400" />
                </div>
                <CardTitle className="mb-2">Sin behaviors</CardTitle>
                <CardDescription>No hay comportamientos configurados para esta aplicación.</CardDescription>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {behaviors.map((behavior) => (
                  <Card
                    key={behavior.id}
                    className="p-6 cursor-pointer hover:border-primary/30 transition-all group"
                    onClick={() => fetchBehaviorDetails(behavior.id)}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-500/20 to-orange-500/20 flex items-center justify-center text-rose-400 group-hover:scale-110 transition-transform">
                        <Puzzle className="w-5 h-5" />
                      </div>
                      <Badge
                        variant={behavior.is_active ? 'secondary' : 'outline'}
                        className={cn(behavior.is_active ? 'bg-emerald-500/10 text-emerald-400 border-0' : 'bg-muted text-muted-foreground')}
                      >
                        {behavior.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </div>

                    <CardTitle className="text-lg mb-1">{behavior.behavior_code}</CardTitle>
                    <p className="text-xs text-muted-foreground font-mono mb-4">{behavior.id}</p>

                    <div className="text-xs text-muted-foreground mt-auto pt-4 border-t border-border flex flex-col gap-1">
                      <div className="flex justify-between">
                        <span>Actualizado:</span>
                        <span className="text-foreground">{new Date(behavior.updated_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Creado:</span>
                        <span className="text-foreground">{new Date(behavior.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </motion.div>

      <Dialog open={isBehaviorModalOpen && !!selectedBehavior} onOpenChange={(open) => !open && setIsBehaviorModalOpen(false)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedBehavior && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-400">
                    <Puzzle className="w-6 h-6" />
                  </div>
                  <div>
                    <DialogTitle>{selectedBehavior.behavior_code}</DialogTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant={selectedBehavior.is_active ? 'secondary' : 'outline'}
                        className={cn(selectedBehavior.is_active ? 'bg-emerald-500/10 text-emerald-400 border-0' : 'bg-muted text-muted-foreground')}
                      >
                        {selectedBehavior.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-mono">{selectedBehavior.id}</span>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-8">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                    <Settings className="w-4 h-4" /> Configuración JSON
                  </h3>
                  <div className="bg-muted/50 rounded-2xl p-4 border font-mono text-sm overflow-x-auto">
                    <pre className="text-sky-300">{JSON.stringify(selectedBehavior.config, null, 2)}</pre>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground font-medium uppercase">Creado por</div>
                    <div className="text-sm font-mono">{selectedBehavior.created_by}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground font-medium uppercase">App ID</div>
                    <div className="text-sm font-mono">{selectedBehavior.app_id}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground font-medium uppercase">Fecha de creación</div>
                    <div className="text-sm">{new Date(selectedBehavior.created_at).toLocaleString()}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground font-medium uppercase">Última actualización</div>
                    <div className="text-sm">{new Date(selectedBehavior.updated_at).toLocaleString()}</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
