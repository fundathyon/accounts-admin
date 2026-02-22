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
  XCircle,
  Loader2,
  Copy,
  MoreVertical,
  Users,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Trash2,
  ChevronRight,
  KeyRound,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { OAuthProviderLogo } from '@/components/oauth-provider-logo';
import type { User } from '@/lib/admin-types';

function truncateKey(key: string) {
  if (!key || key.length <= 20) return key;
  return key.slice(0, 12) + '••••••••••••' + key.slice(-8);
}

export default function UsersPage() {
  const router = useRouter();
  const { apiUrl, showNotification, savedSecretKey, savedPublishableKey } = useAdmin();
  const { t } = useI18n();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSignupModalOpen, setIsSignupModalOpen] = useState(false);
  const [signupForm, setSignupForm] = useState({ email: '', password: '', role: 'default', user_name: '' });
  const [isSignupSubmitting, setIsSignupSubmitting] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [signupResult, setSignupResult] = useState<{ access_token?: string; refresh_token?: string; message?: string } | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationCodeSize, setVerificationCodeSize] = useState(6);
  const [isVerificationSubmitting, setIsVerificationSubmitting] = useState(false);
  const [resendCodeMode, setResendCodeMode] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [isResendSubmitting, setIsResendSubmitting] = useState(false);
  const [isSigninModalOpen, setIsSigninModalOpen] = useState(false);
  const [signinForm, setSigninForm] = useState({ email: '', password: '' });
  const [isSigninSubmitting, setIsSigninSubmitting] = useState(false);
  const [showSigninPassword, setShowSigninPassword] = useState(false);
  const [signinResult, setSigninResult] = useState<{ access_token?: string; refresh_token?: string; message?: string } | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPublicKeyModalOpen, setIsPublicKeyModalOpen] = useState(false);
  const [publicKeyValue, setPublicKeyValue] = useState<string | null>(null);
  const [publicKeyLoading, setPublicKeyLoading] = useState(false);

  const fetchPublicKeyJWT = async () => {
    setIsPublicKeyModalOpen(true);
    setPublicKeyLoading(true);
    setPublicKeyValue(null);
    try {
      const headers: Record<string, string> = {};
      if (savedSecretKey) headers['X-Secret-API-Key'] = savedSecretKey;
      const res = await fetch(apiUrl('/api/system/public-key-jwt'), { headers });
      const data = await res.json();
      if (data.success && data.data) {
        setPublicKeyValue(data.data);
      } else {
        showNotification(data.error?.message || t('users.errorLoadPublicKey'), 'error');
      }
    } catch {
      showNotification(t('users.errorConnectionPublicKey'), 'error');
    } finally {
      setPublicKeyLoading(false);
    }
  };

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
      else showNotification(data.error?.message || data.errors?.[0] || t('users.errorLoadUsers'), 'error');
    } catch {
      showNotification(t('users.errorConnectionUsers'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [savedSecretKey]);

  const keyForAuth = savedPublishableKey;

  const handleSignup = async () => {
    if (!keyForAuth) {
      showNotification(t('users.configPublishableKey'), 'error');
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
            message: message || t('users.userRegistered'),
          });
          fetchUsers();
        } else {
          setNeedsVerification(true);
          setVerificationCode('');
          if (savedSecretKey) {
            try {
              const behRes = await fetch(apiUrl('/api/behaviors'), {
                headers: { 'X-Secret-API-Key': savedSecretKey },
              });
              const behData = await behRes.json();
              const emailAuth = (behData.data || []).find((b: { behavior_code?: string }) => b.behavior_code === 'email_auth');
              if (emailAuth?.id) {
                const detailRes = await fetch(apiUrl(`/api/behaviors/${emailAuth.id}`), {
                  headers: { 'X-Secret-API-Key': savedSecretKey },
                });
                const detailData = await detailRes.json();
                const size = detailData.data?.config?.verification?.code_size;
                if (typeof size === 'number' && size > 0) setVerificationCodeSize(size);
              }
            } catch {
              /* usar default 6 */
            }
          }
        }
      } else {
        const errMsg = data.error?.message ?? data.errors?.[0] ?? payload?.message ?? t('users.errorRegister');
        showNotification(errMsg, 'error');
      }
    } catch {
      showNotification(t('users.errorConnection'), 'error');
    } finally {
      setIsSignupSubmitting(false);
    }
  };

  const handleActivate = async () => {
    if (!keyForAuth || !signupForm.email.trim() || !verificationCode.trim()) {
      showNotification('Email y código son requeridos', 'error');
      return;
    }
    setIsVerificationSubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/emails/activate'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Publishable-API-Key': keyForAuth,
        },
        body: JSON.stringify({
          email: signupForm.email.trim(),
          code: verificationCode.trim(),
        }),
      });
      const data = await res.json();
      const payload = data.data ?? data;
      if (res.ok && (data.data || data.success)) {
        const accessToken = payload?.access_token ?? payload?.jwt;
        const refreshToken = payload?.refresh_token;
        setSignupResult({
          access_token: accessToken,
          refresh_token: refreshToken,
          message: 'Cuenta activada. Tokens de sesión:',
        });
        setNeedsVerification(false);
        setVerificationCode('');
        fetchUsers();
      } else {
        const errMsg = data.error?.message ?? data.errors?.[0] ?? payload?.message ?? 'Código inválido o expirado';
        showNotification(errMsg, 'error');
      }
    } catch {
      showNotification('Error al verificar', 'error');
    } finally {
      setIsVerificationSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    if (!keyForAuth || !resendEmail.trim()) {
      showNotification('Email es requerido', 'error');
      return;
    }
    setIsResendSubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/emails/signup/resend-code'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Publishable-API-Key': keyForAuth,
        },
        body: JSON.stringify({ email: resendEmail.trim() }),
      });
      const data = await res.json();
      if (res.ok && (data.data || data.success)) {
        showNotification('Código reenviado. Revisa tu correo.', 'success');
        setSignupForm((p) => ({ ...p, email: resendEmail.trim() }));
        setResendCodeMode(false);
        setNeedsVerification(true);
        setVerificationCode('');
      } else {
        const errMsg = data.error?.message ?? data.errors?.[0] ?? 'Error al reenviar el código';
        showNotification(errMsg, 'error');
      }
    } catch {
      showNotification('Error al reenviar', 'error');
    } finally {
      setIsResendSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!savedSecretKey || !userToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(apiUrl(`/api/users/${userToDelete.id}`), {
        method: 'DELETE',
        headers: { 'X-Secret-API-Key': savedSecretKey },
      });
      const data = await res.json();
      if (res.ok && (data.status === 200 || data.data?.message)) {
        showNotification('Usuario eliminado correctamente', 'success');
        setUserToDelete(null);
        fetchUsers();
      } else {
        const errObj = Array.isArray(data.errors) ? data.errors[0] : data.error;
        showNotification(errObj?.message || 'Error al eliminar', 'error');
      }
    } catch {
      showNotification('Error al conectar', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSignin = async () => {
    if (!keyForAuth) {
      showNotification(t('users.configPublishableKey'), 'error');
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
      showNotification(t('users.errorConnection'), 'error');
    } finally {
      setIsSigninSubmitting(false);
    }
  };

  const settingsHref = `${BASE_PATH}/settings`.replace(/\/+/g, '/') || '/settings';

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">{t('users.title')}</h1>
          <div className="flex gap-2">
            {savedSecretKey && (
              <>
                <Button onClick={() => setIsSignupModalOpen(true)} className="gap-2">
                  <Plus className="w-4 h-4" /> {t('users.registerUser')}
                </Button>
                <Button variant="outline" onClick={() => setIsSigninModalOpen(true)} className="gap-2">
                  <Lock className="w-4 h-4" /> {t('users.testLogin')}
                </Button>
              </>
            )}
            <Button
              variant="outline"
              onClick={fetchPublicKeyJWT}
              className="gap-2"
              title="Ver la clave pública JWT para verificar tokens"
            >
              <KeyRound className="w-4 h-4" /> {t('users.publicKeyJwt')}
            </Button>
            {!savedSecretKey && (
              <Button variant="outline" asChild className="gap-2 border-amber-500/20 text-amber-500 hover:bg-amber-500/10">
                <Link href={settingsHref}>
                  <Key className="w-4 h-4" /> {t('users.configSecretKey')}
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
            <CardTitle className="text-amber-300 mb-2">{t('users.secretKeyRequired')}</CardTitle>
            <CardDescription className="mb-6">{t('users.secretKeyRequiredDesc')}</CardDescription>
            <Button asChild>
              <Link href={settingsHref}>{t('users.goToSettings')}</Link>
            </Button>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="px-6 py-3 bg-emerald-500/5 border-b border-emerald-500/10 flex items-center gap-2 text-xs text-emerald-400">
              <ShieldCheck className="w-4 h-4 shrink-0" /> {t('users.consultingWith')} <span className="font-mono">{truncateKey(savedSecretKey)}</span>
            </div>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-b hover:bg-transparent">
                    <TableHead className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('users.user')}</TableHead>
                    <TableHead className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('users.provider')}</TableHead>
                    <TableHead className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('users.role')}</TableHead>
                    <TableHead className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('users.created')}</TableHead>
                    <TableHead className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('users.lastActivity')}</TableHead>
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
                        {t('users.noUsers')}
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
                            <div className="flex flex-wrap items-center gap-2">
                              {user.login_methods?.map((lm) =>
                                lm.entity_type === 'oauth' && lm.details?.platform ? (
                                  <OAuthProviderLogo
                                    key={lm.id}
                                    provider={lm.details.platform}
                                    size={22}
                                    className="rounded"
                                  />
                                ) : lm.entity_type === 'email' ? (
                                  <span
                                    key={lm.id}
                                    className="inline-flex items-center justify-center gap-0.5 shrink-0"
                                    title={lm.is_verify ? 'Email verificado' : 'Email no verificado'}
                                  >
                                    <span className="inline-flex items-center justify-center w-[22px] h-[22px]">
                                      <img src="/email-svgrepo-com.svg" alt="Email" className="w-full h-full" />
                                    </span>
                                    {lm.is_verify ? (
                                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                                    ) : (
                                      <XCircle className="w-2.5 h-2.5 text-rose-400 shrink-0" />
                                    )}
                                  </span>
                                ) : (
                                  <Badge
                                    key={lm.id}
                                    variant="outline"
                                    className="text-[10px] px-1.5 py-0 font-medium border-orange-500/40 text-orange-400 bg-orange-500/5"
                                  >
                                    {lm.entity_type}
                                    {lm.is_verify ? (
                                      <CheckCircle2 className="w-2.5 h-2.5 ml-0.5 text-emerald-400 inline" />
                                    ) : (
                                      <XCircle className="w-2.5 h-2.5 ml-0.5 text-rose-400 inline" />
                                    )}
                                  </Badge>
                                )
                              ) || <span className="text-muted-foreground text-xs">—</span>}
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
                          <TableCell className="px-6 py-3" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`${BASE_PATH}/users/${user.id}`.replace(/\/+/g, '/'));
                                  }}
                                >
                                  <ChevronRight className="w-4 h-4" />
                                  {t('users.viewDetail')}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-rose-500 focus:text-rose-500"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setUserToDelete(user);
                                  }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Eliminar cuenta
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
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
            setNeedsVerification(false);
            setVerificationCode('');
            setResendCodeMode(false);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              {signupResult
                ? 'Usuario registrado'
                : resendCodeMode
                  ? 'Reenviar código'
                  : needsVerification
                    ? 'Verificar email'
                    : t('users.registerUser')}
            </DialogTitle>
            <DialogDescription>
              {signupResult
                ? signupResult.message
                : resendCodeMode
                  ? 'Introduce el email de la cuenta para recibir un nuevo código de verificación.'
                  : needsVerification
                    ? `Introduce el código de ${verificationCodeSize} dígitos enviado a ${signupForm.email}`
                    : 'Registra un nuevo usuario con email y contraseña en la aplicación.'}
            </DialogDescription>
          </DialogHeader>
          {resendCodeMode ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleResendCode();
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  required
                  placeholder="usuario@ejemplo.com"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setResendCodeMode(false)}>
                  Volver
                </Button>
                <Button type="submit" disabled={isResendSubmitting} className="gap-2">
                  {isResendSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Reenviar código
                </Button>
              </DialogFooter>
            </form>
          ) : needsVerification ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleActivate();
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Código de verificación</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={verificationCodeSize}
                  placeholder={'0'.repeat(verificationCodeSize)}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, verificationCodeSize))}
                  className="font-mono text-center text-lg tracking-[0.5em]"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Código de {verificationCodeSize} dígitos enviado a tu correo
                </p>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground gap-2"
                  onClick={() => {
                    setResendEmail(signupForm.email);
                    setResendCodeMode(true);
                  }}
                >
                  <RefreshCw className="w-4 h-4" />
                  Reenviar código
                </Button>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setNeedsVerification(false);
                    setVerificationCode('');
                  }}
                >
                  Volver
                </Button>
                <Button type="submit" disabled={isVerificationSubmitting || verificationCode.length !== verificationCodeSize} className="gap-2">
                  {isVerificationSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Verificar
                </Button>
              </DialogFooter>
            </form>
          ) : signupResult ? (
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
                    setNeedsVerification(false);
                    setVerificationCode('');
                    setResendCodeMode(false);
                  }}
                >
                  {t('users.close')}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              {!keyForAuth && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {t('users.configPublishableForSignup')}
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
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="text-muted-foreground h-auto p-0 gap-2"
                    onClick={() => {
                      setResendEmail(signupForm.email || '');
                      setResendCodeMode(true);
                    }}
                  >
                    <RefreshCw className="w-4 h-4" />
                    ¿Ya te registraste? Reenviar código
                  </Button>
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
                      setNeedsVerification(false);
                      setVerificationCode('');
                      setResendCodeMode(false);
                    }}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSignupSubmitting} className="flex-1 gap-2">
                    {isSignupSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isSignupSubmitting ? t('users.registering') : t('users.register')}
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
                  {t('users.close')}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              {!keyForAuth && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {t('users.configPublishableKeyShort')}
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
                    {t('common.cancel')}
                  </Button>
                  <Button type="submit" disabled={isSigninSubmitting} className="flex-1 gap-2">
                    {isSigninSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isSigninSubmitting ? t('users.signingIn') : t('users.testLogin')}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isPublicKeyModalOpen} onOpenChange={(open) => !open && setIsPublicKeyModalOpen(false)}>
        <DialogContent className="sm:max-w-2xl max-w-full max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              {t('users.publicKeyJwt')}
            </DialogTitle>
            <DialogDescription>
              {t('users.publicKeyJwtDesc')}
            </DialogDescription>
          </DialogHeader>
          {publicKeyLoading ? (
            <div className="py-8 flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              {t('common.loading')}
            </div>
          ) : publicKeyValue ? (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">{t('users.publicKey')}</Label>
              <div className="flex gap-2">
                <textarea
                  readOnly
                  value={publicKeyValue}
                  rows={10}
                  className="flex-1 font-mono text-xs p-3 rounded-md border bg-muted/30 min-w-0 resize-none"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={() => {
                    navigator.clipboard.writeText(publicKeyValue);
                    showNotification(t('common.copied'), 'success');
                  }}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('users.deleteAccount')}</DialogTitle>
            <DialogDescription>
              {t('users.deleteConfirm')}
              {userToDelete && (
                <span className="mt-2 block text-foreground font-medium">
                  {userToDelete.login_methods?.find((lm) => lm.entity_type === 'email')?.details?.email || userToDelete.user_name || userToDelete.id}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserToDelete(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={isDeleting} className="gap-2">
              {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
