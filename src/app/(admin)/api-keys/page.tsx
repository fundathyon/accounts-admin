'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Key,
  Plus,
  Loader2,
  Copy,
  AlertCircle,
  Layers,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAdmin } from '@/context/admin-context';
import { BASE_PATH } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { App } from '@/lib/admin-types';

function truncateKey(key: string) {
  if (!key || key.length <= 20) return key;
  return key.slice(0, 12) + '••••••••••••' + key.slice(-8);
}

export default function ApiKeysPage() {
  const { apiUrl, showNotification } = useAdmin();
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [formData, setFormData] = useState({ app_id: '', name: '', description: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedKeys, setGeneratedKeys] = useState<{
    publishable_key?: string;
    secret_key?: string;
    app_id?: string;
    created_at?: string;
  } | null>(null);

  const fetchApps = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/apps'));
      const data = await res.json();
      if (data.success) setApps(data.data || []);
      else showNotification(data.error?.message || 'Error al cargar apps', 'error');
    } catch {
      showNotification('Error de conexión con la API', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.app_id || !formData.name.trim()) {
      showNotification('Selecciona una aplicación y un nombre', 'error');
      return;
    }
    setIsSubmitting(true);
    setGeneratedKeys(null);
    try {
      const res = await fetch(apiUrl('/api/api-keys/generate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: formData.app_id,
          name: formData.name.trim(),
          ...(formData.description.trim() && { description: formData.description.trim() }),
        }),
      });
      const data = await res.json();
      const payload = data.data ?? data;
      if (res.ok && (data.success || payload?.publishable_key || payload?.secret_key)) {
        setGeneratedKeys({
          publishable_key: payload.publishable_key,
          secret_key: payload.secret_key,
          app_id: payload.app_id,
          created_at: payload.created_at,
        });
        fetchApps();
      } else {
        showNotification(data.error?.message || payload?.message || 'Error al generar API Keys', 'error');
      }
    } catch {
      showNotification('Error de conexión', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeModal = () => {
    setIsGenerateModalOpen(false);
    setFormData({ app_id: '', name: '', description: '' });
    setGeneratedKeys(null);
  };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">API Keys</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Genera pares de API Keys (pública y secreta) para tus aplicaciones.
            </p>
          </div>
          <Button onClick={() => setIsGenerateModalOpen(true)} className="gap-2" disabled={loading || apps.length === 0}>
            <Plus className="w-4 h-4" /> Generar API Keys
          </Button>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
          </div>
        ) : apps.length === 0 ? (
          <Card className="border-dashed p-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Layers className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="mb-2">Sin aplicaciones</CardTitle>
            <CardDescription className="mb-6">
              Crea una aplicación primero para poder generar API Keys.
            </CardDescription>
            <Button asChild>
              <Link href={`${BASE_PATH}/apps`.replace(/\/+/g, '/') || '/apps'}>Ir a Aplicaciones</Link>
            </Button>
          </Card>
        ) : (
          <Card className="p-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <Key className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg mb-2">Generar nuevas API Keys</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Cada par incluye una <strong>publishable key</strong> (pk_...) para operaciones públicas (signup, signin) y una{' '}
                  <strong>secret key</strong> (sk_...) para operaciones administrativas. Las keys solo se muestran una vez al generarlas.
                </p>
                <Button onClick={() => setIsGenerateModalOpen(true)} className="gap-2">
                  <Plus className="w-4 h-4" /> Generar API Keys
                </Button>
              </div>
            </div>
          </Card>
        )}
      </motion.div>

      <Dialog open={isGenerateModalOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-primary" />
              {generatedKeys ? 'API Keys generadas' : 'Generar API Keys'}
            </DialogTitle>
            <DialogDescription>
              {generatedKeys
                ? 'Guarda estas keys de forma segura. Solo se muestran una vez.'
                : 'Genera un nuevo par de API Keys para una aplicación.'}
            </DialogDescription>
          </DialogHeader>
          {generatedKeys ? (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                La secret_key no se volverá a mostrar. Guárdala en un lugar seguro.
              </div>
              {generatedKeys.publishable_key && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Publishable Key</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={generatedKeys.publishable_key}
                      className="font-mono text-xs overflow-x-auto min-w-0"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedKeys!.publishable_key!);
                        showNotification('Publishable key copiada', 'success');
                      }}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
              {generatedKeys.secret_key && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Secret Key</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={generatedKeys.secret_key}
                      className="font-mono text-xs overflow-x-auto min-w-0"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedKeys!.secret_key!);
                        showNotification('Secret key copiada', 'success');
                      }}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button onClick={closeModal}>Cerrar</Button>
                <Button variant="outline" onClick={() => { setGeneratedKeys(null); setFormData({ app_id: '', name: '', description: '' }); }}>
                  Generar otro par
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleGenerate} className="space-y-4">
              <div className="space-y-2">
                <Label>Aplicación *</Label>
                <select
                  required
                  value={formData.app_id}
                  onChange={(e) => setFormData((p) => ({ ...p, app_id: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
                >
                  <option value="">Selecciona una aplicación</option>
                  {apps.map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.name} ({truncateKey(app.id)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input
                  required
                  placeholder="Producción"
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Descripción (opcional)</Label>
                <Input
                  placeholder="API Keys para entorno de producción"
                  value={formData.description}
                  onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                />
              </div>
              <DialogFooter className="gap-4 pt-4">
                <Button type="button" variant="outline" onClick={closeModal}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting} className="gap-2">
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSubmitting ? 'Generando…' : 'Generar'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
