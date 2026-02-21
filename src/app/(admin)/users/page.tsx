'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Lock,
  Key,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  Copy,
  MoreVertical,
  Users,
  AlertCircle,
  Eye,
  EyeOff,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { User } from '@/lib/admin-types';

function truncateKey(key: string) {
  if (!key || key.length <= 20) return key;
  return key.slice(0, 12) + '••••••••••••' + key.slice(-8);
}

export default function UsersPage() {
  const router = useRouter();
  const { apiUrl, showNotification, savedSecretKey, savedPublishableKey, savedPusheableKey } = useAdmin();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSignupModalOpen, setIsSignupModalOpen] = useState(false);
  const [signupForm, setSignupForm] = useState({ email: '', password: '', role: 'default', user_name: '' });
  const [isSignupSubmitting, setIsSignupSubmitting] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [signupResult, setSignupResult] = useState<{ access_token?: string; refresh_token?: string; message?: string } | null>(null);
  const [isSigninModalOpen, setIsSigninModalOpen] = useState(false);
  const [signinForm, setSigninForm] = useState({ email: '', password: '' });
  const [isSigninSubmitting, setIsSigninSubmitting] = useState(false);
  const [showSigninPassword, setShowSigninPassword] = useState(false);
  const [signinResult, setSigninResult] = useState<{ access_token?: string; refresh_token?: string; message?: string } | null>(null);

  const fetchUsers = async () => {
    if (!savedSecretKey) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/users'), { headers: { 'X-Secret-API-Key': savedSecretKey } });
      const data = await res.json();
      if (data.data && (data.status === 200 || data.success)) setUsers(data.data || []);
      else showNotification(data.error?.message || data.errors?.[0] || 'Error al cargar usuarios', 'error');
    } catch {
      showNotification('Error de conexión con la API de Usuarios', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [savedSecretKey]);

  const keyForAuth = savedPublishableKey || savedPusheableKey;

  const handleSignup = async () => {
    if (!keyForAuth) {
      showNotification('Configura la Publishable API Key o la Pusheable API Key en Configuración', 'error');
      return;
    }
    if (!signupForm.email.trim() || !signupForm.password.trim()) {
      showNotification('Email y contraseña son requeridos', 'error');
      return;
    }
    setIsSignupSubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/emails/signup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Publishable-API-Key': keyForAuth },
        body: JSON.stringify({
          email: signupForm.email.trim(),
          password: signupForm.password,
          role: signupForm.role || 'default',
          ...(signupForm.user_name.trim() && { user_name: signupForm.user_name.trim() }),
        }),
      });
      const data = await res.json();
      const payload = data.data ?? data;
      if (res.ok && (data.data || data.success)) {
        const accessToken = payload?.access_token ?? payload?.jwt;
        const refreshToken = payload?.refresh_token;
        const message = payload?.message;
        if (accessToken || refreshToken) {
          setSignupResult({
            access_token: accessToken,
            refresh_token: refreshToken,
            message: message || 'Usuario registrado. Tokens de sesión:',
          });
          fetchUsers();
        } else {
          showNotification(message || 'Usuario registrado correctamente', 'success');
          setIsSignupModalOpen(false);
          setSignupForm({ email: '', password: '', role: 'default', user_name: '' });
          setShowSignupPassword(false);
          fetchUsers();
        }
      } else {
        const errMsg = data.error?.message ?? data.errors?.[0] ?? payload?.message ?? 'Error al registrar';
        showNotification(errMsg, 'error');
      }
    } catch {
      showNotification('Error de conexión', 'error');
    } finally {
      setIsSignupSubmitting(false);
    }
  };

  const handleSignin = async () => {
    if (!keyForAuth) {
      showNotification('Configura la Publishable API Key o la Pusheable API Key en Configuración', 'error');
      return;
    }
    if (!signinForm.email.trim() || !signinForm.password) {
      showNotification('Email y contraseña son requeridos', 'error');
      return;
    }
    setIsSigninSubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/emails/signin'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Publishable-API-Key': keyForAuth },
        body: JSON.stringify({ email: signinForm.email.trim(), password: signinForm.password }),
      });
      const data = await res.json();
      const payload = data.data ?? data;
      if (res.ok && (data.data || data.success)) {
        const accessToken = payload?.access_token ?? payload?.jwt;
        const refreshToken = payload?.refresh_token;
        const message = payload?.message;
        if (accessToken || refreshToken) {
          setSigninResult({
            access_token: accessToken,
            refresh_token: refreshToken,
            message: message || 'Sesión iniciada. Tokens:',
          });
        } else {
          showNotification(message || 'Sesión iniciada correctamente', 'success');
          setIsSigninModalOpen(false);
          setSigninForm({ email: '', password: '' });
          setShowSigninPassword(false);
        }
      } else {
        const errMsg = data.error?.message ?? data.errors?.[0] ?? payload?.message ?? 'Error al iniciar sesión';
        showNotification(errMsg, 'error');
      }
    } catch {
      showNotification('Error de conexión', 'error');
    } finally {
      setIsSigninSubmitting(false);
    }
  };

  const settingsHref = `${BASE_PATH}/settings`.replace(/\/+/g, '/') || '/settings';

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Usuarios</h1>
          <div className="flex gap-2">
            {savedSecretKey && (
              <>
                <Button onClick={() => setIsSignupModalOpen(true)} className="gap-2">
                  <Plus className="w-4 h-4" /> Registrar usuario
                </Button>
                <Button variant="outline" onClick={() => setIsSigninModalOpen(true)} className="gap-2">
                  <Lock className="w-4 h-4" /> Iniciar sesión
                </Button>
              </>
            )}
            {!savedSecretKey && (
              <Button variant="outline" asChild className="gap-2 border-amber-500/20 text-amber-500 hover:bg-amber-500/10">
                <Link href={settingsHref}>
                  <Key className="w-4 h-4" /> Configura tu Secret API Key
                </Link>
              </Button>
            )}
          </div>
        </div>
        {!savedSecretKey ? (
          <Card className="border-amber-500/20 p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
              <Key className="w-8 h-8 text-amber-400" />
            </div>
            <CardTitle className="text-amber-300 mb-2">Secret API Key Requerida</CardTitle>
            <CardDescription className="mb-6">Necesitas configurar la Secret API Key en Configuración.</CardDescription>
            <Button asChild>
              <Link href={settingsHref}>Ir a Configuración</Link>
            </Button>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="px-6 py-3 bg-emerald-500/5 border-b border-emerald-500/10 flex items-center gap-2 text-xs text-emerald-400">
              <ShieldCheck className="w-4 h-4 shrink-0" /> Consultando con: <span className="font-mono">{truncateKey(savedSecretKey)}</span>
            </div>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-b hover:bg-transparent">
                    <TableHead className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Usuario</TableHead>
                    <TableHead className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Provider</TableHead>
                    <TableHead className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Rol</TableHead>
                    <TableHead className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Creado</TableHead>
                    <TableHead className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Última actividad</TableHead>
                    <TableHead className="px-6 py-3 w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-20 text-center">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-16 text-center text-muted-foreground text-sm">
                        No hay usuarios registrados
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user) => {
                      const primaryEmail = user.login_methods?.find((lm) => lm.entity_type === 'email')?.details?.email;
                      const displayName = user.name || user.user_name || primaryEmail || 'Sin nombre';
                      return (
                        <TableRow
                          key={user.id}
                          className="group cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => router.push(`${BASE_PATH}/users/${user.id}`.replace(/\/+/g, '/'))}
                        >
                          <TableCell className="px-6 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary font-semibold text-xs shrink-0">
                                {(displayName || 'U').charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="font-mono text-xs text-muted-foreground truncate max-w-[140px]" title={user.id}>
                                  {user.id}
                                </div>
                                <div className="font-medium text-sm truncate">{primaryEmail || user.user_name || '—'}</div>
                                {displayName !== primaryEmail && displayName !== user.user_name && (
                                  <div className="text-xs text-muted-foreground truncate">{displayName}</div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="px-6 py-3">
                            <div className="flex flex-wrap gap-1">
                              {user.login_methods?.map((lm) => (
                                <Badge
                                  key={lm.id}
                                  variant="outline"
                                  className={cn(
                                    'text-[10px] px-1.5 py-0 font-medium',
                                    lm.entity_type === 'email'
                                      ? 'border-sky-500/40 text-sky-400 bg-sky-500/5'
                                      : 'border-orange-500/40 text-orange-400 bg-orange-500/5'
                                  )}
                                >
                                  {lm.entity_type}
                                  {lm.is_verify && <CheckCircle2 className="w-2.5 h-2.5 ml-0.5 text-emerald-400 inline" />}
                                </Badge>
                              )) || <span className="text-muted-foreground text-xs">—</span>}
                            </div>
                          </TableCell>
                          <TableCell className="px-6 py-3">
                            {user.role_details ? (
                              <Badge variant="secondary" className="text-xs font-normal">
                                {user.role_details.name}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell className="px-6 py-3 text-xs text-muted-foreground">
                            {new Date(user.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </TableCell>
                          <TableCell className="px-6 py-3 text-xs text-muted-foreground">
                            {new Date(user.updated_at).toLocaleDateString('es', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </TableCell>
                          <TableCell
                            className="px-6 py-3"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`${BASE_PATH}/users/${user.id}`.replace(/\/+/g, '/'));
                            }}
                          >
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`${BASE_PATH}/users/${user.id}`.replace(/\/+/g, '/'));
                              }}
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </motion.div>

      <Dialog
        open={isSignupModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsSignupModalOpen(false);
            setSignupForm({ email: '', password: '', role: 'default', user_name: '' });
            setShowSignupPassword(false);
            setSignupResult(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              {signupResult ? 'Usuario registrado' : 'Registrar usuario'}
            </DialogTitle>
            <DialogDescription>
              {signupResult ? signupResult.message : 'Registra un nuevo usuario con email y contraseña en la aplicación.'}
            </DialogDescription>
          </DialogHeader>
          {signupResult ? (
            <div className="space-y-4">
              {signupResult.access_token && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Access Token (JWT)</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={signupResult.access_token} className="font-mono text-xs overflow-x-auto min-w-0" />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(signupResult!.access_token!);
                        showNotification('Token copiado', 'success');
                      }}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
              {signupResult.refresh_token && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Refresh Token</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={signupResult.refresh_token} className="font-mono text-xs overflow-x-auto min-w-0" />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(signupResult!.refresh_token!);
                        showNotification('Token copiado', 'success');
                      }}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button
                  onClick={() => {
                    setIsSignupModalOpen(false);
                    setSignupForm({ email: '', password: '', role: 'default', user_name: '' });
                    setShowSignupPassword(false);
                    setSignupResult(null);
                  }}
                >
                  Cerrar
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              {!keyForAuth && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Configura la Publishable API Key o la Pusheable API Key en Configuración para registrar usuarios.
                </div>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSignup();
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    required
                    placeholder="usuario@ejemplo.com"
                    value={signupForm.email}
                    onChange={(e) => setSignupForm((p) => ({ ...p, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contraseña *</Label>
                  <div className="relative">
                    <Input
                      type={showSignupPassword ? 'text' : 'password'}
                      required
                      placeholder="SecurePass123!"
                      value={signupForm.password}
                      onChange={(e) => setSignupForm((p) => ({ ...p, password: e.target.value }))}
                      className="pr-12"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      onClick={() => setShowSignupPassword((v) => !v)}
                    >
                      {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Rol</Label>
                  <Input
                    placeholder="default"
                    value={signupForm.role}
                    onChange={(e) => setSignupForm((p) => ({ ...p, role: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">Por defecto: default</p>
                </div>
                <div className="space-y-2">
                  <Label>Nombre de usuario (opcional)</Label>
                  <Input
                    placeholder="john_doe"
                    value={signupForm.user_name}
                    onChange={(e) => setSignupForm((p) => ({ ...p, user_name: e.target.value }))}
                  />
                </div>
                <DialogFooter className="gap-4 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsSignupModalOpen(false);
                      setSignupForm({ email: '', password: '', role: 'default', user_name: '' });
                      setShowSignupPassword(false);
                      setSignupResult(null);
                    }}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSignupSubmitting} className="flex-1 gap-2">
                    {isSignupSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isSignupSubmitting ? 'Registrando…' : 'Registrar'}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={isSigninModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsSigninModalOpen(false);
            setSigninForm({ email: '', password: '' });
            setShowSigninPassword(false);
            setSigninResult(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              {signinResult ? 'Sesión iniciada' : 'Iniciar sesión'}
            </DialogTitle>
            <DialogDescription>
              {signinResult ? signinResult.message : 'Ingresa email y contraseña para obtener los tokens de sesión.'}
            </DialogDescription>
          </DialogHeader>
          {signinResult ? (
            <div className="space-y-4">
              {signinResult.access_token && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Access Token (JWT)</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={signinResult.access_token} className="font-mono text-xs overflow-x-auto min-w-0" />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(signinResult!.access_token!);
                        showNotification('Token copiado', 'success');
                      }}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
              {signinResult.refresh_token && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Refresh Token</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={signinResult.refresh_token} className="font-mono text-xs overflow-x-auto min-w-0" />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(signinResult!.refresh_token!);
                        showNotification('Token copiado', 'success');
                      }}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button
                  onClick={() => {
                    setIsSigninModalOpen(false);
                    setSigninForm({ email: '', password: '' });
                    setShowSigninPassword(false);
                    setSigninResult(null);
                  }}
                >
                  Cerrar
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              {!keyForAuth && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Configura la Publishable API Key o la Pusheable API Key en Configuración.
                </div>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSignin();
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    required
                    placeholder="usuario@ejemplo.com"
                    value={signinForm.email}
                    onChange={(e) => setSigninForm((p) => ({ ...p, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contraseña *</Label>
                  <div className="relative">
                    <Input
                      type={showSigninPassword ? 'text' : 'password'}
                      required
                      placeholder="SecurePass123!"
                      value={signinForm.password}
                      onChange={(e) => setSigninForm((p) => ({ ...p, password: e.target.value }))}
                      className="pr-12"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      onClick={() => setShowSigninPassword((v) => !v)}
                    >
                      {showSigninPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <DialogFooter className="gap-4 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsSigninModalOpen(false);
                      setSigninForm({ email: '', password: '' });
                      setShowSigninPassword(false);
                      setSigninResult(null);
                    }}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSigninSubmitting} className="flex-1 gap-2">
                    {isSigninSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isSigninSubmitting ? 'Iniciando…' : 'Iniciar sesión'}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
