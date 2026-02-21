'use client';

import { useState, useEffect } from 'react';
import {
  Key,
  Bell,
  ShieldCheck,
  Users,
  Server,
  RefreshCw,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAdmin } from '@/context/admin-context';
import { apiUrl } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { EnvVar } from '@/lib/admin-types';

export default function SettingsPage() {
  const {
    savedSecretKey,
    savedAdminKey,
    savedPublishableKey,
    savedPusheableKey,
    setSavedSecretKey,
    setSavedAdminKey,
    setSavedPublishableKey,
    setSavedPusheableKey,
    showNotification,
  } = useAdmin();

  const [secretApiKey, setSecretApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [adminApiKey, setAdminApiKey] = useState('');
  const [showAdminKey, setShowAdminKey] = useState(false);
  const [pusheableApiKey, setPusheableApiKey] = useState('');
  const [showPusheableKey, setShowPusheableKey] = useState(false);
  const [publishableApiKey, setPublishableApiKey] = useState('');
  const [showPublishableKey, setShowPublishableKey] = useState(false);

  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [envLoading, setEnvLoading] = useState(false);
  const [envError, setEnvError] = useState('');
  const [showSensitiveValues, setShowSensitiveValues] = useState<Record<string, boolean>>({});
  const [hasRevealedEnvVars, setHasRevealedEnvVars] = useState(false);

  useEffect(() => {
    setSecretApiKey(savedSecretKey);
    setAdminApiKey(savedAdminKey);
    setPusheableApiKey(savedPusheableKey);
    setPublishableApiKey(savedPublishableKey);
  }, [savedSecretKey, savedAdminKey, savedPusheableKey, savedPublishableKey]);

  const handleSaveKey = () => {
    if (!secretApiKey.trim()) {
      showNotification('La Secret API Key no puede estar vacía', 'error');
      return;
    }
    setSavedSecretKey(secretApiKey.trim());
    showNotification('Secret API Key guardada correctamente', 'success');
  };

  const handleClearKey = () => {
    setSavedSecretKey('');
    setSecretApiKey('');
    showNotification('Secret API Key eliminada', 'success');
  };

  const handleSaveAdminKey = () => {
    if (!adminApiKey.trim()) {
      showNotification('El Admin API Key no puede estar vacío', 'error');
      return;
    }
    setSavedAdminKey(adminApiKey.trim());
    showNotification('Admin API Key guardado correctamente', 'success');
  };

  const handleClearAdminKey = () => {
    setSavedAdminKey('');
    setAdminApiKey('');
    setEnvVars([]);
    showNotification('Admin API Key eliminado', 'success');
  };

  const handleSavePusheableKey = () => {
    if (!pusheableApiKey.trim()) {
      showNotification('La Pusheable API Key no puede estar vacía', 'error');
      return;
    }
    setSavedPusheableKey(pusheableApiKey.trim());
    showNotification('Pusheable API Key guardada correctamente', 'success');
  };

  const handleClearPusheableKey = () => {
    setSavedPusheableKey('');
    setPusheableApiKey('');
    showNotification('Pusheable API Key eliminada', 'success');
  };

  const handleSavePublishableKey = () => {
    if (!publishableApiKey.trim()) {
      showNotification('La Publishable API Key no puede estar vacía', 'error');
      return;
    }
    setSavedPublishableKey(publishableApiKey.trim());
    showNotification('Publishable API Key guardada correctamente', 'success');
  };

  const handleClearPublishableKey = () => {
    setSavedPublishableKey('');
    setPublishableApiKey('');
    showNotification('Publishable API Key eliminada', 'success');
  };

  const fetchEnvVars = async (revealSensitive = false) => {
    if (!savedAdminKey) {
      showNotification('Configura el Admin API Key primero', 'error');
      return;
    }
    setEnvLoading(true);
    setEnvError('');
    try {
      const url = revealSensitive ? apiUrl('/api/system/env?reveal_sensitive=1') : apiUrl('/api/system/env');
      const res = await fetch(url, { headers: { 'X-Admin-API-Key': savedAdminKey } });
      const data = await res.json();
      if (data.success && data.data) {
        setEnvVars(data.data);
        if (revealSensitive) setHasRevealedEnvVars(true);
        else {
          setHasRevealedEnvVars(false);
          setShowSensitiveValues({});
        }
        if (!revealSensitive) showNotification(`${data.data.length} variables cargadas`, 'success');
      } else {
        setEnvError(data.error?.message || 'Error al cargar variables de entorno');
      }
    } catch {
      setEnvError('Error de conexión con el servidor');
    } finally {
      setEnvLoading(false);
    }
  };

  const handleToggleSensitive = async (key: string) => {
    const willShow = !showSensitiveValues[key];
    if (willShow && !hasRevealedEnvVars) {
      if (!savedAdminKey) return;
      setEnvLoading(true);
      setEnvError('');
      try {
        const res = await fetch(apiUrl('/api/system/env?reveal_sensitive=1'), {
          headers: { 'X-Admin-API-Key': savedAdminKey },
        });
        const data = await res.json();
        if (data.success && data.data) {
          setEnvVars(data.data);
          setHasRevealedEnvVars(true);
          setShowSensitiveValues((prev) => ({ ...prev, [key]: true }));
        } else {
          showNotification(data.error?.message || 'Error al cargar valores', 'error');
        }
      } catch {
        showNotification('Error de conexión', 'error');
      } finally {
        setEnvLoading(false);
      }
    } else {
      setShowSensitiveValues((prev) => ({ ...prev, [key]: willShow }));
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="text-3xl font-bold mb-8">Configuración</h1>
      <div className="max-w-3xl space-y-6">
        <Card className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Secret API Key</CardTitle>
              <CardDescription>Para consultar usuarios y webhooks de tu aplicación</CardDescription>
            </div>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Secret API Key</Label>
              <div className="relative">
                <Input
                  type={showKey ? 'text' : 'password'}
                  placeholder="sk_live_..."
                  value={secretApiKey}
                  onChange={(e) => setSecretApiKey(e.target.value)}
                  className="pr-12 font-mono"
                />
                <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setShowKey((v) => !v)}>
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleSaveKey} className="flex-1 gap-2">
                <Key className="w-4 h-4" /> Guardar Key
              </Button>
              {savedSecretKey && (
                <Button variant="outline" onClick={handleClearKey} className="border-destructive/30 text-destructive hover:bg-destructive/10">
                  Eliminar
                </Button>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-violet-500/10 flex items-center justify-center text-violet-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Pusheable API Key</CardTitle>
              <CardDescription>Para enviar notificaciones push con Pusheable</CardDescription>
            </div>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Pusheable API Key</Label>
              <div className="relative">
                <Input
                  type={showPusheableKey ? 'text' : 'password'}
                  placeholder="pk_..."
                  value={pusheableApiKey}
                  onChange={(e) => setPusheableApiKey(e.target.value)}
                  className="pr-12 font-mono"
                />
                <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setShowPusheableKey((v) => !v)}>
                  {showPusheableKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleSavePusheableKey} className="flex-1 gap-2 bg-violet-600 hover:bg-violet-500">
                <Bell className="w-4 h-4" /> Guardar Pusheable Key
              </Button>
              {savedPusheableKey && (
                <Button variant="outline" onClick={handleClearPusheableKey} className="border-destructive/30 text-destructive hover:bg-destructive/10">
                  Eliminar
                </Button>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Admin API Key</CardTitle>
              <CardDescription>Para acceder a las variables de entorno del servidor</CardDescription>
            </div>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Admin API Key</Label>
              <div className="relative">
                <Input
                  type={showAdminKey ? 'text' : 'password'}
                  placeholder="Ej: secret"
                  value={adminApiKey}
                  onChange={(e) => setAdminApiKey(e.target.value)}
                  className="pr-12 font-mono"
                />
                <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setShowAdminKey((v) => !v)}>
                  {showAdminKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground px-1">
                Corresponde a la variable <code className="text-rose-400 bg-rose-500/10 px-1 rounded">ADMIN_API_KEY</code> del servidor.
              </p>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleSaveAdminKey} className="flex-1 gap-2 bg-rose-600 hover:bg-rose-500">
                <ShieldCheck className="w-4 h-4" /> Guardar Admin Key
              </Button>
              {savedAdminKey && (
                <Button variant="outline" onClick={handleClearAdminKey} className="border-destructive/30 text-destructive hover:bg-destructive/10">
                  Eliminar
                </Button>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Publishable API Key</CardTitle>
              <CardDescription>Para registrar usuarios (signup) e iniciar sesión (signin). Se obtiene al crear una app.</CardDescription>
            </div>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Publishable API Key</Label>
              <div className="relative">
                <Input
                  type={showPublishableKey ? 'text' : 'password'}
                  placeholder="pk_live_..."
                  value={publishableApiKey}
                  onChange={(e) => setPublishableApiKey(e.target.value)}
                  className="pr-12 font-mono"
                />
                <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setShowPublishableKey((v) => !v)}>
                  {showPublishableKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground px-1">
                Obtén la <code className="text-emerald-400 bg-emerald-500/10 px-1 rounded">publishable_key</code> al crear una aplicación.
              </p>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleSavePublishableKey} className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-500">
                <Users className="w-4 h-4" /> Guardar Publishable Key
              </Button>
              {savedPublishableKey && (
                <Button variant="outline" onClick={handleClearPublishableKey} className="border-destructive/30 text-destructive hover:bg-destructive/10">
                  Eliminar
                </Button>
              )}
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between p-6 border-b">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-sky-500/10 flex items-center justify-center text-sky-400">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Variables de Entorno</CardTitle>
                <CardDescription>Estado actual de la configuración del servidor</CardDescription>
              </div>
            </div>
            <Button onClick={() => fetchEnvVars()} disabled={envLoading || !savedAdminKey} className="gap-2 bg-sky-600 hover:bg-sky-500">
              {envLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {envLoading ? 'Cargando…' : 'Cargar Vars'}
            </Button>
          </CardHeader>

          {envError && (
            <div className="mx-6 mt-4 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <div>
                <span className="font-semibold">Error: </span>
                {envError}
                {envError.includes('disabled') && (
                  <span className="block mt-1 text-muted-foreground text-xs">
                    Asegúrate de tener <code className="text-sky-400">EXPOSE_ENV=true</code> en tu archivo <code>.env.local</code>
                  </span>
                )}
              </div>
            </div>
          )}

          {!savedAdminKey && envVars.length === 0 && (
            <div className="p-10 text-center text-muted-foreground text-sm">
              <Server className="w-8 h-8 mx-auto mb-3 opacity-30" />
              Configura el Admin API Key para cargar las variables de entorno del servidor.
            </div>
          )}

          {envVars.length > 0 && (
            <div className="divide-y divide-border">
              {Array.from(new Set(envVars.map((e) => e.category))).map((category) => (
                <div key={category}>
                  <div className="px-6 py-2 bg-muted/30">
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{category}</span>
                  </div>
                  {envVars
                    .filter((e) => e.category === category)
                    .map((envVar) => (
                      <div key={envVar.key} className="px-6 py-3 hover:bg-muted/50 transition-colors flex items-center gap-4">
                        <div className="w-64 shrink-0">
                          <span
                            className={cn(
                              'text-xs font-mono font-semibold',
                              envVar.sensitive ? 'text-amber-400' : 'text-sky-400'
                            )}
                          >
                            {envVar.key}
                          </span>
                          {envVar.sensitive && (
                            <span className="ml-2 px-1.5 py-0.5 bg-amber-500/10 text-amber-500 rounded text-[10px] font-semibold">
                              SENSIBLE
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          {envVar.sensitive ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-mono text-muted-foreground truncate">
                                {showSensitiveValues[envVar.key] ? envVar.value : '••••••••'}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                                onClick={() => handleToggleSensitive(envVar.key)}
                                disabled={envLoading}
                              >
                                {showSensitiveValues[envVar.key] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </Button>
                            </div>
                          ) : (
                            <span
                              className={cn(
                                'text-sm font-mono truncate block',
                                envVar.value === 'false'
                                  ? 'text-muted-foreground'
                                  : envVar.value === 'true'
                                    ? 'text-emerald-400'
                                    : envVar.value === ''
                                      ? 'text-muted-foreground italic'
                                      : 'text-foreground'
                              )}
                            >
                              {envVar.value === '' ? '(vacío)' : envVar.value}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <CardTitle className="text-base mb-3">Notas de seguridad</CardTitle>
          <ul className="space-y-1.5 text-sm text-muted-foreground list-disc list-inside">
            <li>
              Las keys se almacenan solo en <code className="text-primary bg-primary/10 px-1 rounded">localStorage</code> de tu navegador.
            </li>
            <li>Los valores de campos sensibles aparecen enmascarados por defecto.</li>
            <li>
              El endpoint de entorno requiere <code className="text-sky-400 bg-sky-500/10 px-1 rounded">EXPOSE_ENV=true</code> en el servidor.
            </li>
            <li>
              Nunca actives <code className="text-rose-400">EXPOSE_ENV=true</code> en producción.
            </li>
          </ul>
        </Card>
      </div>
    </motion.div>
  );
}
