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
  ShieldCheck,
  Trash2,
  PowerOff,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAdmin } from '@/context/admin-context';
import { BASE_PATH } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
import type { App, APIKeyListItem } from '@/lib/admin-types';

function truncateKey(key: string) {
  if (!key || key.length <= 20) return key;
  return key.slice(0, 12) + '••••••••••••' + key.slice(-8);
}

export default function ApiKeysPage() {
  const { apiUrl, showNotification, savedSecretKey } = useAdmin();
  const [apps, setApps] = useState<App[]>([]);
  const [apiKeys, setApiKeys] = useState<APIKeyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [keysLoading, setKeysLoading] = useState(true);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [formData, setFormData] = useState({ app_id: '', name: '', description: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedApiKey, setSelectedApiKey] = useState<APIKeyListItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [generatedKeys, setGeneratedKeys] = useState<{
    publishable_key?: string;
    secret_key?: string;
    app_id?: string;
    created_at?: string;
  } | null>(null);

  const settingsHref = `${BASE_PATH}/settings`.replace(/\/+/g, '/') || '/settings';

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

  const fetchAPIKeys = async () => {
    if (!savedSecretKey) {
      setKeysLoading(false);
      return;
    }
    setKeysLoading(true);
    try {
      const res = await fetch(apiUrl('/api/api-keys'), {
        headers: { 'X-Secret-API-Key': savedSecretKey },
      });
      const data = await res.json();
      if (data.success) setApiKeys(data.data || []);
      else showNotification(data.error?.message || 'Error al cargar API Keys', 'error');
    } catch {
      showNotification('Error de conexión con la API', 'error');
    } finally {
      setKeysLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, []);

  useEffect(() => {
    fetchAPIKeys();
  }, [savedSecretKey]);

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
        fetchAPIKeys();
      } else {
        showNotification(data.error?.message || payload?.message || 'Error al generar API Keys', 'error');
      }
    } catch {
      showNotification('Error de conexión', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async () => {
    if (!selectedApiKey || !savedSecretKey) return;
    setActionLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/api-keys/${selectedApiKey.id}`), {
        method: 'PATCH',
        headers: {
          'X-Secret-API-Key': savedSecretKey,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (data.success || res.ok) {
        showNotification('API Key desactivada correctamente', 'success');
        setSelectedApiKey(null);
        fetchAPIKeys();
      } else {
        showNotification(data.error?.message || 'Error al desactivar API Key', 'error');
      }
    } catch {
      showNotification('Error de conexión', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedApiKey || !savedSecretKey) return;
    if (!window.confirm(`¿Eliminar permanentemente la API Key "${selectedApiKey.name}"? Esta acción no se puede deshacer.`)) return;
    setActionLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/api-keys/${selectedApiKey.id}`), {
        method: 'DELETE',
        headers: { 'X-Secret-API-Key': savedSecretKey },
      });
      const data = await res.json();
      if (data.success || res.ok) {
        showNotification('API Key eliminada correctamente', 'success');
        setSelectedApiKey(null);
        fetchAPIKeys();
      } else {
        showNotification(data.error?.message || 'Error al eliminar API Key', 'error');
      }
    } catch {
      showNotification('Error de conexión', 'error');
    } finally {
      setActionLoading(false);
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
          {!savedSecretKey ? (
            <Button variant="outline" asChild className="gap-2 border-amber-500/20 text-amber-500 hover:bg-amber-500/10">
              <Link href={settingsHref}>
                <Key className="w-4 h-4" /> Configura tu Secret API Key
              </Link>
            </Button>
          ) : (
            <Button onClick={() => setIsGenerateModalOpen(true)} className="gap-2" disabled={loading || apps.length === 0}>
              <Plus className="w-4 h-4" /> Generar API Keys
            </Button>
          )}
        </div>

        {!savedSecretKey ? (
          <Card className="border-amber-500/20 p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
              <Key className="w-8 h-8 text-amber-400" />
            </div>
            <CardTitle className="text-amber-300 mb-2">Secret API Key Requerida</CardTitle>
            <CardDescription className="mb-6">
              Configura la Secret API Key en Configuración para listar las API Keys de tu aplicación.
              La app se identifica mediante la Secret Key (sk_...).
            </CardDescription>
            <Button asChild>
              <Link href={settingsHref}>Ir a Configuración</Link>
            </Button>
          </Card>
        ) : loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
          </div>
        ) : apps.length === 0 && apiKeys.length === 0 ? (
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
          <div className="space-y-4">
            {savedSecretKey && (
              <div className="px-6 py-3 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-center gap-2 text-xs text-emerald-400">
                <ShieldCheck className="w-4 h-4" /> Consultando con: <span className="font-mono">{truncateKey(savedSecretKey)}</span>
              </div>
            )}

            {keysLoading ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : apiKeys.length > 0 ? (
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b">
                        <TableHead className="px-8 py-4">Nombre</TableHead>
                        <TableHead className="px-8 py-4">Descripción</TableHead>
                        <TableHead className="px-8 py-4">Publishable Key</TableHead>
                        <TableHead className="px-8 py-4">Estado</TableHead>
                        <TableHead className="px-8 py-4">Entorno</TableHead>
                        <TableHead className="px-8 py-4">Creado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {apiKeys.map((k) => (
                        <TableRow
                          key={k.id}
                          className="group cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => setSelectedApiKey(k)}
                        >
                          <TableCell className="px-8 py-4 font-medium">{k.name}</TableCell>
                          <TableCell className="px-8 py-4 text-muted-foreground">{k.description || '—'}</TableCell>
                          <TableCell className="px-8 py-4 text-xs font-mono text-muted-foreground max-w-[200px] truncate" title={k.publishable_key}>
                            {k.publishable_key}
                          </TableCell>
                          <TableCell className="px-8 py-4">
                            <Badge variant={k.is_active ? 'secondary' : 'outline'} className={k.is_active ? 'bg-emerald-500/10 text-emerald-400 border-0' : ''}>
                              {k.is_active ? 'Activa' : 'Inactiva'}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-8 py-4 text-muted-foreground capitalize">{k.environment}</TableCell>
                          <TableCell className="px-8 py-4 text-xs text-muted-foreground">
                            {k.created_at ? new Date(k.created_at).toLocaleDateString() : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : null}

            {apps.length > 0 && (
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
          </div>
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

      <Dialog open={!!selectedApiKey} onOpenChange={(open) => !open && setSelectedApiKey(null)}>
        <DialogContent className="sm:max-w-2xl max-w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-primary" />
              Detalles de la API Key
              {selectedApiKey && (
                <span className="text-muted-foreground font-normal">({selectedApiKey.name})</span>
              )}
            </DialogTitle>
            <DialogDescription>
              Información de la API Key de tu aplicación.
            </DialogDescription>
          </DialogHeader>

          {selectedApiKey && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">ID</Label>
                  <p className="text-sm font-mono break-all">{selectedApiKey.id}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">App ID</Label>
                  <p className="text-sm font-mono break-all">{selectedApiKey.app_id}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Nombre</Label>
                  <p className="text-sm font-semibold">{selectedApiKey.name}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Estado</Label>
                  <Badge variant={selectedApiKey.is_active ? 'secondary' : 'outline'} className={selectedApiKey.is_active ? 'bg-emerald-500/10 text-emerald-400 border-0' : ''}>
                    {selectedApiKey.is_active ? 'Activa' : 'Inactiva'}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Entorno</Label>
                  <p className="text-sm capitalize">{selectedApiKey.environment}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Key ID</Label>
                  <p className="text-sm font-mono">{selectedApiKey.key_id}</p>
                </div>
              </div>

              {selectedApiKey.description && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Descripción</Label>
                  <p className="text-sm">{selectedApiKey.description}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Publishable Key</Label>
                <div className="flex gap-2">
                  <p className="text-sm font-mono break-all bg-muted/50 rounded-lg p-3 flex-1 min-w-0">{selectedApiKey.publishable_key}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    title="Copiar"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedApiKey.publishable_key);
                      showNotification('Publishable key copiada', 'success');
                    }}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground/80">
                La secret key no se muestra tras la creación por seguridad. Usa la Secret API Key configurada en Configuración.
              </p>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Creado</Label>
                  <p className="text-sm">{selectedApiKey.created_at ? new Date(selectedApiKey.created_at).toLocaleString() : '—'}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Actualizado</Label>
                  <p className="text-sm">{selectedApiKey.updated_at ? new Date(selectedApiKey.updated_at).toLocaleString() : '—'}</p>
                </div>
                {selectedApiKey.last_used_at && (
                  <div className="space-y-2 col-span-2">
                    <Label className="text-muted-foreground text-xs">Último uso</Label>
                    <p className="text-sm">{new Date(selectedApiKey.last_used_at).toLocaleString()}</p>
                  </div>
                )}
                {selectedApiKey.revoked_at && (
                  <div className="space-y-2 col-span-2">
                    <Label className="text-muted-foreground text-xs">Revocada</Label>
                    <p className="text-sm text-amber-500">{new Date(selectedApiKey.revoked_at).toLocaleString()}</p>
                  </div>
                )}
              </div>

              <DialogFooter className="pt-4 gap-2 flex-wrap">
                <div className="flex gap-2 ml-auto">
                  {selectedApiKey.is_active && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actionLoading}
                      onClick={handleDeactivate}
                      className="gap-1.5 text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
                    >
                      {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PowerOff className="w-3.5 h-3.5" />}
                      Desactivar
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={actionLoading}
                    onClick={handleDelete}
                    className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                  >
                    {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    Eliminar
                  </Button>
                </div>
                <Button variant="outline" onClick={() => setSelectedApiKey(null)}>
                  Cerrar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
