'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Plus,
  Lock,
  Key,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  Copy,
  Users,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Trash2,
  ChevronRight,
  Ellipsis,
  KeyRound,
  Download,
  FileCode,
  Search,
  ShieldOff,
  Database,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  Badge,
  Button,
  buttonVariants,
  Card,
  CardBody,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSubmenu,
  DropdownMenuSubmenuTrigger,
  DropdownMenuTrigger,
  FormField,
  Heading,
  Icon,
  IconButton,
  Inline,
  Input,
  RoleBadge,
  Select,
  Stack,
  Text,
  Textarea,
  Tooltip,
  Spinner,
} from '@foundathyon/community-ui';
import type {
  DataTableColumn,
  DataTableRowAction,
  DataTableSort,
} from '@foundathyon/community-ui';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { BASE_PATH, IS_PRODUCTION } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { OAuthProviderLogo } from '@/components/oauth-provider-logo';
import { AdminDataTable, DeleteSelectionButton } from '@/components/admin-data-table';
import type { User, Role, MetadataFieldSchema } from '@/lib/admin-types';

function truncateKey(key: string) {
  if (!key || key.length <= 20) return key;
  return key.slice(0, 12) + '••••••••••••' + key.slice(-8);
}

function primaryEmailOf(user: User) {
  return user.login_methods?.find((lm) => lm.entity_type === 'email')?.details?.email;
}

/** Values the `type` URL param accepts; `all` is the default and is never written. */
const LOGIN_TYPE_FILTERS = ['all', 'email', 'oauth', 'google', 'apple', 'microsoft'] as const;
type LoginTypeFilter = (typeof LOGIN_TYPE_FILTERS)[number];

/**
 * Login-method names as the Select already rendered them — provider names and
 * protocol labels, not product copy. Hoisted so the applied-filter chip can
 * show the same label the picker does.
 */
const LOGIN_TYPE_LABELS: Record<Exclude<LoginTypeFilter, 'all'>, string> = {
  email: 'Email / Password',
  oauth: 'Any OAuth',
  google: 'Google',
  apple: 'Apple',
  microsoft: 'Microsoft',
};

function parseLoginTypeFilter(value: string | null): LoginTypeFilter {
  return LOGIN_TYPE_FILTERS.includes(value as LoginTypeFilter) ? (value as LoginTypeFilter) : 'all';
}

/** §16 search debounce: 250 ms before the query reaches the table and the URL. */
const SEARCH_DEBOUNCE_MS = 250;

/**
 * Searchable text of a row. This is the `user` column's `accessor`, so it is
 * what `DataTable`'s `globalFilter` matches on — and the group-by-role view
 * (which the DataTable API cannot express) reuses it to build its sections.
 */
function userSearchText(user: User) {
  return `${user.id} ${user.user_name || ''} ${primaryEmailOf(user) || ''} ${user.name || ''}`;
}

/**
 * Epoch value for the `date` / `relative-date` cells. Returning a number rather
 * than the raw ISO string keeps human-readable dates out of the global filter,
 * and an unparseable date renders `—` instead of throwing inside `formatDate`.
 */
function timestampOf(value?: string | null) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export default function UsersPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { apiUrl, showNotification, savedSecretKey, savedPublishableKey } = useAdmin();
  const { t } = useI18n();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [isSignupModalOpen, setIsSignupModalOpen] = useState(false);
  const [signupForm, setSignupForm] = useState({ email: '', password: '', user_name: '' });
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
  const [roles, setRoles] = useState<Role[]>([]);
  // `searchInput` is what the field shows (always controlled, never remounted so
  // it keeps the caret and the focus when rows arrive); `searchQuery` is the
  // debounced value the table filters by and the URL carries.
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [loginFilter, setLoginFilter] = useState<LoginTypeFilter>('all');
  const [sort, setSort] = useState<DataTableSort | null>({ id: 'created', direction: 'desc' });
  const [isGroupedByRole, setIsGroupedByRole] = useState(false);
  const [isRevokeRefreshOpen, setIsRevokeRefreshOpen] = useState(false);
  const [revokeByTokenValue, setRevokeByTokenValue] = useState('');
  const [revokeByIdValue, setRevokeByIdValue] = useState('');
  const [revokeLoading, setRevokeLoading] = useState(false);
  const [revokeMode, setRevokeMode] = useState<'token' | 'id'>('token');
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  // The rows behind «Eliminar selección»; `null` means the dialog deletes ALL users.
  const [bulkTargets, setBulkTargets] = useState<User[] | null>(null);
  const [bulkConfirmPhrase, setBulkConfirmPhrase] = useState('');
  const [metadataSchema, setMetadataSchema] = useState<MetadataFieldSchema[] | null>(null);
  const [metadataValues, setMetadataValues] = useState<Record<string, string>>({});
  const [bulkProgress, setBulkProgress] = useState<{
    running: boolean;
    finished: boolean;
    done: number;
    total: number;
    errors: { id: string; email?: string; message: string }[];
  } | null>(null);

  // §16 — the URL IS the state: `?q=` + `?role=` + `?type=` + `?group=role`
  // make a filtered view shareable. The query string seeds the filters once,
  // and every change is written back with `replace` (never `push`: filtering
  // must not fill the history).
  useEffect(() => {
    const q = searchParams.get('q') ?? '';
    setSearchInput(q);
    setSearchQuery(q);
    setRoleFilter(searchParams.get('role') || 'all');
    setLoginFilter(parseLoginTypeFilter(searchParams.get('type')));
    setIsGroupedByRole(searchParams.get('group') === 'role');
    // Mount-only on purpose: from here on the page writes the URL, not the
    // reverse. Seeding in an effect (rather than during render) also keeps the
    // controls out of any prerendered markup, so nothing can mismatch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reads the live query string so unrelated params survive, and never depends
  // on the `searchParams` object — that would re-fire on every replace.
  const writeUrl = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(window.location.search);
      mutate(params);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router]
  );

  // Debounced search: the input stays controlled by `searchInput` (it never
  // remounts, so focus and caret survive the results arriving), and only the
  // settled value reaches the table filter and the URL.
  useEffect(() => {
    if (searchInput === searchQuery) return;
    const id = setTimeout(() => {
      setSearchQuery(searchInput);
      writeUrl((params) => {
        if (searchInput.trim()) params.set('q', searchInput);
        else params.delete('q');
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [searchInput, searchQuery, writeUrl]);

  // Defaults are omitted from the URL so an unfiltered view keeps a clean one.
  const applyRoleFilter = (value: string) => {
    setRoleFilter(value);
    writeUrl((params) => {
      if (value !== 'all') params.set('role', value);
      else params.delete('role');
    });
  };

  const applyLoginFilter = (value: LoginTypeFilter) => {
    setLoginFilter(value);
    writeUrl((params) => {
      if (value !== 'all') params.set('type', value);
      else params.delete('type');
    });
  };

  const toggleGroupByRole = () => {
    const next = !isGroupedByRole;
    setIsGroupedByRole(next);
    writeUrl((params) => {
      if (next) params.set('group', 'role');
      else params.delete('group');
    });
  };

  const handleRevokeByToken = async () => {
    const token = revokeByTokenValue.trim();
    if (!token) {
      showNotification('Introduce el refresh token (JWT) a revocar', 'error');
      return;
    }
    if (!savedSecretKey) {
      showNotification(t('users.configSecretKey') || 'Configura la API Key secreta', 'error');
      return;
    }
    setRevokeLoading(true);
    try {
      const res = await fetch(apiUrl('/api/revoke-refresh'), {
        method: 'POST',
        headers: {
          'X-Secret-API-Key': savedSecretKey,
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.success !== false) {
        showNotification('Refresh token revocado correctamente', 'success');
        setRevokeByTokenValue('');
        setIsRevokeRefreshOpen(false);
      } else {
        showNotification(data.error?.message || data.errors?.[0]?.message || 'Error al revocar', 'error');
      }
    } catch {
      showNotification('Error al conectar', 'error');
    } finally {
      setRevokeLoading(false);
    }
  };

  const handleRevokeById = async () => {
    const id = revokeByIdValue.trim();
    if (!id) {
      showNotification('Introduce el ID del refresh token a revocar', 'error');
      return;
    }
    if (!savedSecretKey) {
      showNotification(t('users.configSecretKey') || 'Configura la API Key secreta', 'error');
      return;
    }
    setRevokeLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/revoke-refresh/${encodeURIComponent(id)}`), {
        method: 'DELETE',
        headers: { 'X-Secret-API-Key': savedSecretKey },
      });
      const data = await res.json();
      if (res.ok && data.success !== false) {
        showNotification('Refresh token revocado correctamente', 'success');
        setRevokeByIdValue('');
        setIsRevokeRefreshOpen(false);
      } else {
        showNotification(data.error?.message || data.errors?.[0]?.message || 'Error al revocar', 'error');
      }
    } catch {
      showNotification('Error al conectar', 'error');
    } finally {
      setRevokeLoading(false);
    }
  };

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
    setUsersError(null);
    try {
      const res = await fetch(apiUrl('/api/users'), { headers: { 'X-Secret-API-Key': savedSecretKey } });
      const data = await res.json();
      if (data.data && (data.status === 200 || data.success)) setUsers(data.data || []);
      else {
        const message = data.error?.message || data.errors?.[0] || t('users.errorLoadUsers');
        setUsersError(message);
        showNotification(message, 'error');
      }
    } catch {
      setUsersError(t('users.errorConnectionUsers'));
      showNotification(t('users.errorConnectionUsers'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    if (!savedSecretKey) return;
    try {
      const res = await fetch(apiUrl('/api/roles'), { headers: { 'X-Secret-API-Key': savedSecretKey } });
      const data = await res.json();
      if (data.success && data.data) {
        const list = Array.isArray(data.data) ? data.data : (data.data.data || []);
        setRoles(list);
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, [savedSecretKey]);

  const keyForAuth = savedPublishableKey;

  const openSignupModal = async () => {
    setMetadataValues({});
    setMetadataSchema(null);
    setIsSignupModalOpen(true);
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
          const schema = detailData.data?.config?.metadata_schema;
          if (schema?.enabled && Array.isArray(schema.scheme) && schema.scheme.length > 0) {
            setMetadataSchema(schema.scheme);
            const defaults: Record<string, string> = {};
            schema.scheme.forEach((f: MetadataFieldSchema) => { defaults[f.name] = ''; });
            setMetadataValues(defaults);
          }
        }
      } catch { /* skip, metadata schema is optional */ }
    }
  };

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
      const metadataPayload: Record<string, unknown> = {};
      if (metadataSchema && metadataSchema.length > 0) {
        metadataSchema.forEach((field) => {
          const raw = metadataValues[field.name] ?? '';
          if (raw === '' && !field.required) return;
          if (field.type === 'number') {
            metadataPayload[field.name] = raw !== '' ? Number(raw) : undefined;
          } else if (field.type === 'boolean') {
            metadataPayload[field.name] = raw === 'true';
          } else {
            metadataPayload[field.name] = raw;
          }
        });
      }
      const res = await fetch(apiUrl('/api/emails/signup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Publishable-API-Key': keyForAuth },
        body: JSON.stringify({
          email: signupForm.email.trim(),
          password: signupForm.password,
          ...(signupForm.user_name.trim() && { user_name: signupForm.user_name.trim() }),
          ...(Object.keys(metadataPayload).length > 0 && { metadata: metadataPayload }),
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

  const handleBulkDeleteUsers = async (selection?: User[]) => {
    if (!savedSecretKey) return;
    // «Eliminar todos» stays out of production; deleting an explicit selection
    // is the row action in bulk, so it is allowed wherever the row action is.
    if (!selection && IS_PRODUCTION) return;
    const targets = selection ? selection.slice() : users.slice();
    if (targets.length === 0) {
      showNotification(t('users.deleteAllNoUsers'), 'error');
      return;
    }

    setBulkProgress({
      running: true,
      finished: false,
      done: 0,
      total: targets.length,
      errors: [],
    });

    const CONCURRENCY = 5;
    let cursor = 0;
    let done = 0;
    const errors: { id: string; email?: string; message: string }[] = [];

    const worker = async () => {
      while (true) {
        const i = cursor++;
        if (i >= targets.length) return;
        const user = targets[i];
        const email = user.login_methods?.find((lm) => lm.entity_type === 'email')?.details?.email;
        try {
          const res = await fetch(apiUrl(`/api/users/${user.id}`), {
            method: 'DELETE',
            headers: { 'X-Secret-API-Key': savedSecretKey },
          });
          const data = await res.json().catch(() => ({}));
          const isOk = res.ok && (data?.status === 200 || data?.success || data?.data?.message);
          if (!isOk) {
            const errObj = Array.isArray(data?.errors) ? data.errors[0] : data?.error;
            errors.push({ id: user.id, email, message: errObj?.message || `HTTP ${res.status}` });
          }
        } catch {
          errors.push({ id: user.id, email, message: t('users.errorConnection') });
        } finally {
          done++;
          setBulkProgress((prev) =>
            prev ? { ...prev, done, errors: errors.slice() } : prev
          );
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker)
    );

    setBulkProgress({
      running: false,
      finished: true,
      done,
      total: targets.length,
      errors,
    });
    await fetchUsers();
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

  // Role and login-method are faceted filters. `DataTable` exposes a single
  // `globalFilter` and no per-column filtering, so these two stay on the page
  // and pre-filter the rows the table receives. Search and sort moved into the
  // table (`globalFilter` + the sortable "Creado" / "Última actividad" heads).
  const filteredUsers = users.filter((user) => {
    if (roleFilter !== 'all' && user.role_id !== roleFilter && user.role_details?.name !== roleFilter) return false;

    if (loginFilter !== 'all') {
      if (loginFilter === 'email') {
        if (!user.login_methods?.some(lm => lm.entity_type === 'email')) return false;
      } else if (loginFilter === 'oauth') {
        if (!user.login_methods?.some(lm => lm.entity_type === 'oauth')) return false;
      } else {
        if (!user.login_methods?.some(lm => lm.details?.platform === loginFilter)) return false;
      }
    }

    return true;
  });

  const searchLower = searchQuery.trim().toLowerCase();
  // The rows that survive every filter — the same set the table shows, since
  // `userSearchText` is the accessor its `globalFilter` matches on. Feeds the
  // grouped view and the §30 header count so both agree with the table.
  const searchedUsers = filteredUsers.filter(
    (user) => !searchLower || userSearchText(user).toLowerCase().includes(searchLower)
  );
  // Group key for the §14 grouped view — the table renders one group row per
  // role and keeps the column sort inside each group.
  const roleNameOf = (user: User) => user.role_details?.name || 'default';

  const handleExportCSV = () => {
    if (users.length === 0) {
      showNotification(t('users.noUsersToExport') || 'No users to export', 'error');
      return;
    }

    const headers = ['ID', 'Email', 'Username', 'Name', 'Role', 'Created At'];
    const rows = users.map(user => {
      const primaryEmail = user.login_methods?.find((lm) => lm.entity_type === 'email')?.details?.email || '';
      return [
        user.id,
        primaryEmail,
        user.user_name || '',
        user.name || '',
        user.role_details?.name || 'default',
        new Date(user.created_at).toISOString()
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `users_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification(t('users.exportSuccess') || 'Export successful', 'success');
  };

  const handleExportJSON = () => {
    if (users.length === 0) {
      showNotification(t('users.noUsersToExport') || 'No users to export', 'error');
      return;
    }

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(users, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `users_full_export_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    showNotification(t('users.exportSuccessJSON') || 'JSON export successful', 'success');
  };

  const settingsHref = `${BASE_PATH}/settings`.replace(/\/+/g, '/') || '/settings';
  const bulkPhrase = bulkTargets
    ? t('users.deleteSelectedConfirmPhrase', { count: bulkTargets.length })
    : t('users.deleteAllConfirmPhrase');
  const userHref = (user: User) => `${BASE_PATH}/users/${user.id}`.replace(/\/+/g, '/');


  // §16 — the one exit out of «Sin resultados»: it drops every applied filter,
  // the search term included. Grouping is a view mode, so it survives.
  const clearAllFilters = () => {
    setSearchInput('');
    setSearchQuery('');
    setRoleFilter('all');
    setLoginFilter('all');
    writeUrl((params) => {
      params.delete('q');
      params.delete('role');
      params.delete('type');
    });
  };

  // §16 — an applied filter is never hidden: the search keeps its value and
  // each facet button carries a counter. This only decides which empty copy
  // the table shows when the page-level facets leave nothing to render.
  const filtersActive =
    searchQuery.trim() !== '' || roleFilter !== 'all' || loginFilter !== 'all';

  // §16 — «Sin resultados» is not an empty state: it says nothing matched and
  // offers the way out, which clears every filter including the search term.
  const noResultsStateCopy = {
    icon: Search,
    title: t('common.noResults'),
    description: t('common.noResultsDesc'),
    action: (
      <Button variant="secondary" onClick={clearAllFilters}>
        {t('common.clearFilters')}
      </Button>
    ),
  };

  const userColumns = useMemo<DataTableColumn<User>[]>(() => [
    {
      // §21 Accounts spec — the `user` cell puts the technical id on top (support
      // searches by id) and the human name below; the email is its own column.
      // The global filter searches every part of the object.
      id: 'user',
      header: t('users.user'),
      type: 'user',
      primary: true,
      accessor: (user) => ({
        id: user.id,
        name: user.name || user.user_name || undefined,
        email: primaryEmailOf(user),
      }),
    },
    {
      id: 'email',
      header: t('users.email'),
      type: 'text',
      accessor: (user) => primaryEmailOf(user),
      sortable: true,
    },
    {
      // Hidden by default (toggle it from «Columnas»), still fed to the global
      // filter so "search by username" keeps working as the placeholder promises.
      id: 'username',
      header: 'Username',
      type: 'text',
      accessor: (user) => user.user_name,
    },
    {
      id: 'provider',
      header: t('users.provider'),
      cell: (user) => (
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
              <Badge key={lm.id} variant="outline" tone="warning" className="px-1.5">
                {lm.entity_type}
                {lm.is_verify ? (
                  <CheckCircle2 className="w-2.5 h-2.5 ml-0.5 text-emerald-400 inline" />
                ) : (
                  <XCircle className="w-2.5 h-2.5 ml-0.5 text-rose-400 inline" />
                )}
              </Badge>
            )
          ) || <span className="text-text-muted text-xs">—</span>}
        </div>
      ),
    },
    {
      id: 'role',
      header: t('users.role'),
      cell: (user) =>
        user.role_details ? (
          <RoleBadge role={user.role_details.name} />
        ) : (
          <span className="text-text-muted text-xs">—</span>
        ),
    },
    {
      id: 'created',
      header: t('users.created'),
      type: 'date',
      accessor: (user) => timestampOf(user.created_at),
      sortable: true,
    },
    {
      id: 'lastActivity',
      header: t('users.lastActivity'),
      type: 'relative-date',
      accessor: (user) => timestampOf(user.updated_at),
      sortable: true,
    },
  ], [t]);

  const userRowActions = (user: User): DataTableRowAction[] => [
    {
      label: t('users.viewDetail'),
      icon: ChevronRight,
      onSelect: () => router.push(userHref(user)),
    },
    {
      label: t('users.deleteAccount'),
      icon: Trash2,
      destructive: true,
      onSelect: () => setUserToDelete(user),
    },
  ];

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        {/* §30 — título, subtítulo con el recuento, acciones a la derecha: una
            sola primaria. "Registrar usuario" is that primary; everything else
            (test login, export, revoke, public key, delete all) lives behind
            the overflow menu with its handlers and dialogs untouched. */}
        <Inline justify="between" align="start" className="mb-6">
          <div>
            <Heading level={1}>{t('users.title')}</Heading>
            {/* §30 — the header states the count that matters. */}
            {savedSecretKey && !loading && users.length > 0 && (
              <Text variant="caption" tone="muted" as="span" className="mt-1 block">
                {t('common.countOf', { shown: searchedUsers.length, total: users.length, entity: t('users.title').toLowerCase() })}
              </Text>
            )}
          </div>
          <Inline gap={2}>
            {savedSecretKey ? (
              <Tooltip content={t('tooltips.registerUser')}>
                <Button variant="primary" onClick={openSignupModal} leading={<Icon icon={Plus} size={14} />}>
                  {t('users.registerUser')}
                </Button>
              </Tooltip>
            ) : (
              <Link
                href={settingsHref}
                className={cn(
                  buttonVariants({ variant: 'secondary', size: 'sm' }),
                  'border-amber-500/20 text-amber-500 hover:bg-amber-500/10'
                )}
              >
                <Icon icon={Key} size={14} /> {t('users.configSecretKey')}
              </Link>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="secondary" leading={<Icon icon={Ellipsis} size={14} />}>
                    {t('commandPalette.actions')}
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                {savedSecretKey && (
                  <>
                    <DropdownMenuItem onClick={() => setIsSigninModalOpen(true)} icon={Lock}>
                      {t('users.testLogin')}
                    </DropdownMenuItem>
                    <DropdownMenuSubmenu>
                      <DropdownMenuSubmenuTrigger icon={Download}>
                        {t('users.export')}
                      </DropdownMenuSubmenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={handleExportCSV} icon={Download} className="cursor-pointer text-emerald-500 data-[highlighted]:text-emerald-500 data-[highlighted]:bg-emerald-500/10">
                          CSV
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleExportJSON} icon={FileCode} className="cursor-pointer text-sky-500 data-[highlighted]:text-sky-500 data-[highlighted]:bg-sky-500/10">
                          JSON
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenuSubmenu>
                  </>
                )}
                <DropdownMenuItem onClick={() => setIsRevokeRefreshOpen(true)} icon={ShieldOff}>
                  Revocar refresh token
                </DropdownMenuItem>
                <DropdownMenuItem onClick={fetchPublicKeyJWT} icon={KeyRound}>
                  {t('users.publicKeyJwt')}
                </DropdownMenuItem>
                {/* §12 — destructive goes last, separated, and it only opens the
                    phrase confirmation: the item never deletes anything itself. */}
                {savedSecretKey && !IS_PRODUCTION && users.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      destructive
                      icon={Trash2}
                      onClick={() => {
                        setBulkTargets(null);
                        setBulkConfirmPhrase('');
                        setBulkProgress(null);
                        setIsBulkDeleteOpen(true);
                      }}
                    >
                      {t('users.deleteAll')}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </Inline>
        </Inline>

        {!savedSecretKey ? (
          <Card className="border-amber-500/20">
            <CardBody className="p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                <Key className="w-8 h-8 text-amber-400" />
              </div>
              <Heading level={2} visual="h4" className="text-amber-300 mb-2">{t('users.secretKeyRequired')}</Heading>
              <Text tone="secondary" as="p" className="mb-6">{t('users.secretKeyRequiredDesc')}</Text>
              <Link href={settingsHref} className={buttonVariants({ variant: 'primary', size: 'sm' })}>
                {t('users.goToSettings')}
              </Link>
            </CardBody>
          </Card>
        ) : (
          /* §14 — one frame: toolbar (search · Rol · Tipo de acceso · Columnas,
             and the selection summary with «Eliminar selección» on the right),
             the table, and the footer with the count and the key in use. */
          <AdminDataTable<User>
            entity={t('users.title').toLowerCase()}
            columns={userColumns}
            data={filteredUsers}
            columnVisibility={{ defaultState: { username: false } }}
            rowId={(user) => user.id}
            loading={loading}
            loadingRowCount={6}
            error={usersError ? { title: t('users.errorLoadUsers'), description: usersError, retry: { label: t('common.retry'), onClick: () => { void fetchUsers(); } } } : undefined}
            // The table derives "no results" from `globalFilter` alone, so the
            // page-level role/login facets decide the copy here: rows exist,
            // they just did not survive a filter — and the exit is clearing them.
            emptyState={filtersActive ? noResultsStateCopy : { icon: Users, title: t('users.noUsers') }}
            noResultsState={noResultsStateCopy}
            globalFilter={searchQuery}
            sorting={{ state: sort, onChange: setSort }}
            search={{
              value: searchInput,
              onChange: setSearchInput,
              placeholder: t('users.searchPlaceholder') || 'Search by email, username, name or ID...',
            }}
            filters={[
              {
                id: 'role',
                label: t('users.role'),
                multiple: false,
                value: roleFilter === 'all' ? [] : [roleFilter],
                onChange: (next) => applyRoleFilter(next[0] ?? 'all'),
                options: roles.map((role) => ({
                  value: role.id,
                  label: role.name,
                  count: users.filter((user) => user.role_id === role.id || user.role_details?.name === role.id).length,
                })),
              },
              {
                id: 'type',
                label: t('users.loginType'),
                multiple: false,
                value: loginFilter === 'all' ? [] : [loginFilter],
                onChange: (next) => applyLoginFilter(parseLoginTypeFilter(next[0] ?? null)),
                options: (Object.keys(LOGIN_TYPE_LABELS) as Exclude<LoginTypeFilter, 'all'>[]).map((key) => ({
                  value: key,
                  label: LOGIN_TYPE_LABELS[key],
                })),
              },
            ]}
            columnsButton
            toolbarEnd={
              <Tooltip content={t('tooltips.groupByRole')}>
                <Button
                  variant="ghost"
                  aria-pressed={isGroupedByRole}
                  onClick={toggleGroupByRole}
                  leading={<Icon icon={Users} size={14} />}
                  className={cn(isGroupedByRole && 'bg-accent-bg text-accent')}
                >
                  {t('users.groupByRole') || 'Group by Role'}
                </Button>
              </Tooltip>
            }
            groupBy={isGroupedByRole ? { key: roleNameOf } : undefined}
            selectable
            bulkActions={(rows) => (
              <DeleteSelectionButton
                onClick={() => {
                  setBulkTargets(rows);
                  setBulkConfirmPhrase('');
                  setBulkProgress(null);
                  setIsBulkDeleteOpen(true);
                }}
              />
            )}
            rowActions={userRowActions}
            onRowClick={(user) => router.push(userHref(user))}
            footer={
              <span className="inline-flex items-center gap-1.5">
                <Icon icon={ShieldCheck} size={12} />
                {t('users.consultingWith')}
                <code className="font-mono">{truncateKey(savedSecretKey)}</code>
              </span>
            }
          />
        )}
      </motion.div>

      <Dialog
        open={isSignupModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsSignupModalOpen(false);
            setSignupForm({ email: '', password: '', user_name: '' });
            setShowSignupPassword(false);
            setSignupResult(null);
            setNeedsVerification(false);
            setVerificationCode('');
            setResendCodeMode(false);
          }
        }}
      >
        <DialogContent size="sm" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-accent" />
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
              <FormField label="Email">
                <Input
                  type="email"
                  required
                  placeholder="usuario@ejemplo.com"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                />
              </FormField>
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setResendCodeMode(false)}>
                  Volver
                </Button>
                <Button type="submit" variant="primary" loading={isResendSubmitting}>
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
              <FormField
                label="Código de verificación"
                description={`Código de ${verificationCodeSize} dígitos enviado a tu correo`}
              >
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
              </FormField>
              <Inline justify="end">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-muted"
                  leading={<Icon icon={RefreshCw} size={14} />}
                  onClick={() => {
                    setResendEmail(signupForm.email);
                    setResendCodeMode(true);
                  }}
                >
                  Reenviar código
                </Button>
              </Inline>
              <DialogFooter>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setNeedsVerification(false);
                    setVerificationCode('');
                  }}
                >
                  Volver
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={verificationCode.length !== verificationCodeSize}
                  loading={isVerificationSubmitting}
                >
                  Verificar
                </Button>
              </DialogFooter>
            </form>
          ) : signupResult ? (
            <div className="space-y-4">
              {signupResult.access_token && (
                <FormField label="Access Token (JWT)">
                  <div className="flex gap-2">
                    <Input readOnly value={signupResult.access_token} className="font-mono text-xs overflow-x-auto min-w-0" />
                    <IconButton
                      icon={Copy}
                      label={t('common.copy')}
                      variant="secondary"
                      onClick={() => {
                        navigator.clipboard.writeText(signupResult!.access_token!);
                        showNotification('Token copiado', 'success');
                      }}
                    />
                  </div>
                </FormField>
              )}
              {signupResult.refresh_token && (
                <FormField label="Refresh Token">
                  <div className="flex gap-2">
                    <Input readOnly value={signupResult.refresh_token} className="font-mono text-xs overflow-x-auto min-w-0" />
                    <IconButton
                      icon={Copy}
                      label={t('common.copy')}
                      variant="secondary"
                      onClick={() => {
                        navigator.clipboard.writeText(signupResult!.refresh_token!);
                        showNotification('Token copiado', 'success');
                      }}
                    />
                  </div>
                </FormField>
              )}
              <DialogFooter>
                <Button
                  variant="primary"
                  onClick={() => {
                    setIsSignupModalOpen(false);
                    setSignupForm({ email: '', password: '', user_name: '' });
                    setShowSignupPassword(false);
                    setSignupResult(null);
                    setNeedsVerification(false);
                    setVerificationCode('');
                    setResendCodeMode(false);
                    setMetadataValues({});
                    setMetadataSchema(null);
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
                <FormField label="Email *">
                  <Input
                    type="email"
                    required
                    placeholder="usuario@ejemplo.com"
                    value={signupForm.email}
                    onChange={(e) => setSignupForm((p) => ({ ...p, email: e.target.value }))}
                  />
                </FormField>
                <FormField label="Contraseña *">
                  <Input
                    type={showSignupPassword ? 'text' : 'password'}
                    required
                    placeholder="SecurePass123!"
                    value={signupForm.password}
                    onChange={(e) => setSignupForm((p) => ({ ...p, password: e.target.value }))}
                    trailing={
                      <IconButton
                        icon={showSignupPassword ? EyeOff : Eye}
                        label={showSignupPassword ? t('login.hidePassword') : t('login.showPassword')}
                        variant="ghost"
                        size="xs"
                        onClick={() => setShowSignupPassword((v) => !v)}
                      />
                    }
                  />
                </FormField>
                <FormField label="Nombre de usuario (opcional)">
                  <Input
                    placeholder="john_doe"
                    value={signupForm.user_name}
                    onChange={(e) => setSignupForm((p) => ({ ...p, user_name: e.target.value }))}
                  />
                </FormField>
                {metadataSchema && metadataSchema.length > 0 && (
                  <Stack gap={3} className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
                    <Text variant="overline" as="div" className="text-indigo-400 flex items-center gap-2">
                      <Icon icon={Database} size={12} />
                      {t('users.metadataFields')}
                    </Text>
                    {metadataSchema.map((field) => (
                      <FormField
                        key={field.name}
                        required={field.required}
                        label={
                          <>
                            {field.name}
                            <span className="ml-2 text-[10px] text-muted font-mono">{field.type}</span>
                          </>
                        }
                      >
                        {field.type === 'boolean' ? (
                          <Select
                            value={metadataValues[field.name] || null}
                            onValueChange={(v) => setMetadataValues((p) => ({ ...p, [field.name]: v ?? '' }))}
                            placeholder={field.required ? t('users.metadataSelect') : t('users.metadataOptional')}
                            items={[
                              { value: 'true', label: 'true' },
                              { value: 'false', label: 'false' },
                            ]}
                          />
                        ) : field.enum && field.enum.length > 0 ? (
                          <Select
                            value={metadataValues[field.name] || null}
                            onValueChange={(v) => setMetadataValues((p) => ({ ...p, [field.name]: v ?? '' }))}
                            placeholder={field.required ? t('users.metadataSelect') : t('users.metadataOptional')}
                            items={field.enum.map((opt) => ({ value: opt, label: opt }))}
                          />
                        ) : (
                          <Input
                            type={field.type === 'number' ? 'number' : 'text'}
                            required={field.required}
                            placeholder={field.required ? field.name : `${field.name} (${t('users.optional')})`}
                            value={metadataValues[field.name] ?? ''}
                            onChange={(e) => setMetadataValues((p) => ({ ...p, [field.name]: e.target.value }))}
                          />
                        )}
                      </FormField>
                    ))}
                  </Stack>
                )}
                <Inline justify="end">
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-muted"
                    leading={<Icon icon={RefreshCw} size={14} />}
                    onClick={() => {
                      setResendEmail(signupForm.email || '');
                      setResendCodeMode(true);
                    }}
                  >
                    ¿Ya te registraste? Reenviar código
                  </Button>
                </Inline>
                <DialogFooter className="gap-4 pt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setIsSignupModalOpen(false);
                      setSignupForm({ email: '', password: '', user_name: '' });
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
                  <Button type="submit" variant="primary" disabled={isSignupSubmitting} leading={isSignupSubmitting ? <Spinner size={14} /> : undefined} className="flex-1">
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
        <DialogContent size="sm" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-accent" />
              {signinResult ? 'Sesión iniciada' : 'Iniciar sesión'}
            </DialogTitle>
            <DialogDescription>
              {signinResult ? signinResult.message : 'Ingresa email y contraseña para obtener los tokens de sesión.'}
            </DialogDescription>
          </DialogHeader>
          {signinResult ? (
            <div className="space-y-4">
              {signinResult.access_token && (
                <FormField label="Access Token (JWT)">
                  <div className="flex gap-2">
                    <Input readOnly value={signinResult.access_token} className="font-mono text-xs overflow-x-auto min-w-0" />
                    <IconButton
                      icon={Copy}
                      label={t('common.copy')}
                      variant="secondary"
                      onClick={() => {
                        navigator.clipboard.writeText(signinResult!.access_token!);
                        showNotification('Token copiado', 'success');
                      }}
                    />
                  </div>
                </FormField>
              )}
              {signinResult.refresh_token && (
                <FormField label="Refresh Token">
                  <div className="flex gap-2">
                    <Input readOnly value={signinResult.refresh_token} className="font-mono text-xs overflow-x-auto min-w-0" />
                    <IconButton
                      icon={Copy}
                      label={t('common.copy')}
                      variant="secondary"
                      onClick={() => {
                        navigator.clipboard.writeText(signinResult!.refresh_token!);
                        showNotification('Token copiado', 'success');
                      }}
                    />
                  </div>
                </FormField>
              )}
              <DialogFooter>
                <Button
                  variant="primary"
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
                <FormField label="Email *">
                  <Input
                    type="email"
                    required
                    placeholder="usuario@ejemplo.com"
                    value={signinForm.email}
                    onChange={(e) => setSigninForm((p) => ({ ...p, email: e.target.value }))}
                  />
                </FormField>
                <FormField label="Contraseña *">
                  <Input
                    type={showSigninPassword ? 'text' : 'password'}
                    required
                    placeholder="SecurePass123!"
                    value={signinForm.password}
                    onChange={(e) => setSigninForm((p) => ({ ...p, password: e.target.value }))}
                    trailing={
                      <IconButton
                        icon={showSigninPassword ? EyeOff : Eye}
                        label={showSigninPassword ? t('login.hidePassword') : t('login.showPassword')}
                        variant="ghost"
                        size="xs"
                        onClick={() => setShowSigninPassword((v) => !v)}
                      />
                    }
                  />
                </FormField>
                <DialogFooter className="gap-4 pt-4">
                  <Button
                    type="button"
                    variant="secondary"
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
                  <Button type="submit" variant="primary" disabled={isSigninSubmitting} leading={isSigninSubmitting ? <Spinner size={14} /> : undefined} className="flex-1">
                    {isSigninSubmitting ? t('users.signingIn') : t('users.testLogin')}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isPublicKeyModalOpen} onOpenChange={(open) => !open && setIsPublicKeyModalOpen(false)}>
        <DialogContent size="lg" className="sm:max-w-2xl max-w-full max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-accent" />
              {t('users.publicKeyJwt')}
            </DialogTitle>
            <DialogDescription>
              {t('users.publicKeyJwtDesc')}
            </DialogDescription>
          </DialogHeader>
          {publicKeyLoading ? (
            <div className="py-8 flex items-center justify-center gap-2 text-muted">
              <Loader2 className="w-5 h-5 animate-spin" />
              {t('common.loading')}
            </div>
          ) : publicKeyValue ? (
            <FormField label={t('users.publicKey')}>
              <div className="flex gap-2">
                <Textarea
                  readOnly
                  value={publicKeyValue}
                  rows={10}
                  className="flex-1 font-mono text-xs p-3 min-w-0 resize-none"
                />
                <IconButton
                  icon={Copy}
                  label={t('common.copy')}
                  variant="secondary"
                  className="shrink-0"
                  onClick={() => {
                    navigator.clipboard.writeText(publicKeyValue);
                    showNotification(t('common.copied'), 'success');
                  }}
                />
              </div>
            </FormField>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={isRevokeRefreshOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsRevokeRefreshOpen(false);
            setRevokeByTokenValue('');
            setRevokeByIdValue('');
          }
        }}
      >
        <DialogContent size="sm" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldOff className="w-5 h-5 text-accent" />
              Revocar refresh token
            </DialogTitle>
            <DialogDescription>
              Revoca un refresh token (p. ej. para cerrar sesión en un dispositivo). Requiere API Key secreta. Puedes revocar por JWT o por ID del token.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Inline gap={2} className="border-b border-border pb-2">
              <Button
                type="button"
                variant={revokeMode === 'token' ? 'secondary' : 'ghost'}
                onClick={() => setRevokeMode('token')}
              >
                Por JWT
              </Button>
              <Button
                type="button"
                variant={revokeMode === 'id' ? 'secondary' : 'ghost'}
                onClick={() => setRevokeMode('id')}
              >
                Por ID
              </Button>
            </Inline>
            {revokeMode === 'token' ? (
              <Stack gap={2}>
                <FormField label="Refresh token (JWT)">
                  <Input
                    placeholder="eyJhbGciOiJSUzI1NiIs..."
                    value={revokeByTokenValue}
                    onChange={(e) => setRevokeByTokenValue(e.target.value)}
                    className="font-mono text-xs"
                  />
                </FormField>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleRevokeByToken}
                  loading={revokeLoading}
                  className="w-full"
                >
                  Revocar por token
                </Button>
              </Stack>
            ) : (
              <Stack gap={2}>
                <FormField
                  label="ID del refresh token"
                  description={'El ID es el claim "id" del JWT del refresh token.'}
                >
                  <Input
                    placeholder="uuid-del-token"
                    value={revokeByIdValue}
                    onChange={(e) => setRevokeByIdValue(e.target.value)}
                    className="font-mono text-xs"
                  />
                </FormField>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleRevokeById}
                  loading={revokeLoading}
                  className="w-full"
                >
                  Revocar por ID
                </Button>
              </Stack>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('users.deleteAccount')}</DialogTitle>
            <DialogDescription>
              {t('users.deleteConfirm')}
              {userToDelete && (
                <span className="mt-2 block text-text font-medium">
                  {userToDelete.login_methods?.find((lm) => lm.entity_type === 'email')?.details?.email || userToDelete.user_name || userToDelete.id}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setUserToDelete(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser} loading={isDeleting}>
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isBulkDeleteOpen}
        onOpenChange={(open) => {
          if (bulkProgress?.running) return;
          setIsBulkDeleteOpen(open);
          if (!open) {
            setBulkTargets(null);
            setBulkConfirmPhrase('');
            setBulkProgress(null);
          }
        }}
      >
        <DialogContent size="md" className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-danger">
              <AlertCircle className="w-5 h-5" />
              {bulkTargets
                ? t('common.deleteSelectedTitle', { count: bulkTargets.length, entity: t('users.title').toLowerCase() })
                : t('users.deleteAllTitle')}
            </DialogTitle>
            <DialogDescription>
              {bulkTargets
                ? t('common.deleteSelectedDesc', { count: bulkTargets.length, entity: t('users.title').toLowerCase() })
                : t('users.deleteAllDescription')}
            </DialogDescription>
          </DialogHeader>

          {!bulkProgress ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-danger-border/30 bg-danger-bg/5 p-3 text-sm">
                <p className="text-muted">{t('users.deleteAllConfirmHint')}</p>
                <p className="mt-1 font-mono font-semibold text-danger">
                  {bulkPhrase}
                </p>
              </div>
              <FormField
                label={t('users.deleteAllPhrasePlaceholder')}
                error={
                  bulkConfirmPhrase.length > 0 &&
                    bulkConfirmPhrase !== bulkPhrase
                    ? t('users.deleteAllPhraseMismatch')
                    : undefined
                }
              >
                <Input
                  id="bulk-delete-phrase"
                  value={bulkConfirmPhrase}
                  onChange={(e) => setBulkConfirmPhrase(e.target.value)}
                  placeholder={bulkPhrase}
                  className="font-mono"
                  autoComplete="off"
                />
              </FormField>
              <DialogFooter>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setIsBulkDeleteOpen(false);
                    setBulkTargets(null);
                    setBulkConfirmPhrase('');
                  }}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="destructive"
                  disabled={
                    bulkConfirmPhrase !== bulkPhrase ||
                    (bulkTargets ?? users).length === 0
                  }
                  onClick={() => handleBulkDeleteUsers(bulkTargets ?? undefined)}
                  leading={<Icon icon={Trash2} size={14} />}
                >
                  {t('users.deleteAllConfirmButton', { count: (bulkTargets ?? users).length })}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted">
                    {bulkProgress.running && <Loader2 className="w-4 h-4 animate-spin" />}
                    {bulkProgress.finished
                      ? t('users.deleteAllDone')
                      : t('users.deleteAllInProgress')}
                  </span>
                  <span className="font-mono text-xs text-muted">
                    {t('users.deleteAllProgress', {
                      done: bulkProgress.done,
                      total: bulkProgress.total,
                    })}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-subtle">
                  <div
                    className={cn(
                      'h-full transition-all',
                      bulkProgress.errors.length > 0
                        ? 'bg-amber-500'
                        : 'bg-danger-bg'
                    )}
                    style={{
                      width: `${bulkProgress.total === 0
                        ? 0
                        : Math.round((bulkProgress.done / bulkProgress.total) * 100)
                        }%`,
                    }}
                  />
                </div>
                {bulkProgress.finished && (
                  <p className="text-xs text-muted">
                    {t('users.deleteAllDoneSummary', {
                      ok: bulkProgress.done - bulkProgress.errors.length,
                      failed: bulkProgress.errors.length,
                    })}
                  </p>
                )}
              </div>

              {bulkProgress.errors.length > 0 && (
                <div className="max-h-48 overflow-auto rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs space-y-1">
                  <p className="font-semibold text-amber-500">
                    {t('users.deleteAllErrors', { count: bulkProgress.errors.length })}
                  </p>
                  <ul className="space-y-0.5 text-muted">
                    {bulkProgress.errors.slice(0, 50).map((err) => (
                      <li key={err.id} className="font-mono">
                        <span className="text-text">{err.email || err.id}</span>
                        {' — '}
                        <span className="text-amber-500">{err.message}</span>
                      </li>
                    ))}
                    {bulkProgress.errors.length > 50 && (
                      <li className="italic">…+{bulkProgress.errors.length - 50}</li>
                    )}
                  </ul>
                </div>
              )}

              <DialogFooter>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setIsBulkDeleteOpen(false);
                    setBulkTargets(null);
                    setBulkConfirmPhrase('');
                    setBulkProgress(null);
                  }}
                  disabled={bulkProgress.running}
                >
                  {t('common.close')}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
