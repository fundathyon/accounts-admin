'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Key,
  ShieldCheck,
  ShieldOff,
  ListFilter,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  PlayCircle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  Badge,
  Button,
  buttonVariants,
  Card,
  CardBody,
  CardHeader,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  FormField,
  Heading,
  Icon,
  IconButton,
  Input,
  Select,
  Spinner,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
  Textarea,
} from '@foundathyon/community-ui';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { BASE_PATH, cn } from '@/lib/utils';
import type { EmailAccessEntryView, EmailAccessSettingsView } from '@/lib/admin-types';

const PAGE_SIZE = 20;

function truncateKey(key: string) {
  if (!key || key.length <= 20) return key;
  return key.slice(0, 12) + '••••••••••••' + key.slice(-8);
}

type Tab = 'settings' | 'allow' | 'block';

type SegmentPreset = 'all' | 'email' | 'google' | 'apple' | 'microsoft' | 'github' | 'custom';

const SEGMENT_CUSTOM_RE = /^[a-z][a-z0-9_-]{0,31}$/;

export default function EmailAccessPage() {
  const { apiUrl, showNotification, savedSecretKey } = useAdmin();
  const { t } = useI18n();
  const settingsHref = `${BASE_PATH}/settings`.replace(/\/+/g, '/') || '/settings';

  const [tab, setTab] = useState<Tab>('settings');

  const [settings, setSettings] = useState<EmailAccessSettingsView | null>(null);
  const [signupMode, setSignupMode] = useState<'open' | 'allowlist_required'>('open');
  const [evalBlockOnLogin, setEvalBlockOnLogin] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  const [allowRows, setAllowRows] = useState<EmailAccessEntryView[]>([]);
  const [blockRows, setBlockRows] = useState<EmailAccessEntryView[]>([]);
  const [allowPage, setAllowPage] = useState(0);
  const [blockPage, setBlockPage] = useState(0);
  const [allowMeta, setAllowMeta] = useState<{ totalPages: number; total: number } | null>(null);
  const [blockMeta, setBlockMeta] = useState<{ totalPages: number; total: number } | null>(null);
  const [allowLoading, setAllowLoading] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [addListKind, setAddListKind] = useState<'allow' | 'block'>('allow');
  const [formEntryType, setFormEntryType] = useState<'email' | 'domain'>('email');
  const [formSegmentPreset, setFormSegmentPreset] = useState<SegmentPreset>('all');
  const [formSegmentCustom, setFormSegmentCustom] = useState('');
  const [formValue, setFormValue] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'allow' | 'block'; id: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Test dialog (POST /api/email-access/test)
  const [testOpen, setTestOpen] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testSegment, setTestSegment] = useState<'email' | 'google' | 'apple' | 'microsoft' | 'github'>('email');
  const [testFlow, setTestFlow] = useState<'registration' | 'login'>('registration');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{
    allowed: boolean;
    scope?: string;
    reason?: string;
  } | null>(null);

  const openTestDialog = () => {
    setTestEmail('');
    setTestSegment('email');
    setTestFlow('registration');
    setTestResult(null);
    setTestOpen(true);
  };

  const runEmailAccessTest = async () => {
    const email = testEmail.trim();
    if (!email) {
      showNotification('Email requerido', 'error');
      return;
    }
    if (!savedSecretKey) {
      showNotification(t('emailAccess.secretKeyRequired'), 'error');
      return;
    }
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await fetch(apiUrl('/api/email-access/test'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Secret-API-Key': savedSecretKey },
        body: JSON.stringify({ email, access_segment: testSegment, flow: testFlow }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        showNotification(data?.error?.message || 'No se pudo evaluar', 'error');
        return;
      }
      const r = data.data ?? {};
      setTestResult({ allowed: Boolean(r.allowed), scope: r.scope, reason: r.reason });
    } catch {
      showNotification('Error al conectar con el servidor', 'error');
    } finally {
      setTestLoading(false);
    }
  };

  const loadSettings = useCallback(async () => {
    if (!savedSecretKey) return;
    setSettingsLoading(true);
    try {
      const res = await fetch(apiUrl('/api/email-access/settings'), {
        headers: { 'X-Secret-API-Key': savedSecretKey },
      });
      const data = await res.json();
      if (data.success && data.data) {
        setSettings(data.data);
        setSignupMode(
          data.data.signup_access_mode === 'allowlist_required' ? 'allowlist_required' : 'open'
        );
        setEvalBlockOnLogin(!!data.data.evaluate_blocklist_on_login);
      } else {
        showNotification(data.error?.message || t('emailAccess.loadError'), 'error');
      }
    } catch {
      showNotification(t('emailAccess.loadError'), 'error');
    } finally {
      setSettingsLoading(false);
    }
  }, [apiUrl, savedSecretKey, showNotification, t]);

  const fetchList = useCallback(
    async (kind: 'allow' | 'block', page: number) => {
      if (!savedSecretKey) return;
      const path =
        kind === 'allow'
          ? `/api/email-access/allowlist?page=${page}&size=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`
          : `/api/email-access/blocklist?page=${page}&size=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`;
      const setRows = kind === 'allow' ? setAllowRows : setBlockRows;
      const setMeta = kind === 'allow' ? setAllowMeta : setBlockMeta;
      const setLoading = kind === 'allow' ? setAllowLoading : setBlockLoading;

      setLoading(true);
      try {
        const res = await fetch(apiUrl(path), {
          headers: { 'X-Secret-API-Key': savedSecretKey },
        });
        const data = await res.json();
        if (data.success) {
          setRows(data.data || []);
          const p = data.meta?.pagination as
            | { totalPages?: number; total?: number }
            | undefined;
          if (p) {
            setMeta({
              totalPages: Math.max(1, Number(p.totalPages) || 1),
              total: Number(p.total) || 0,
            });
          } else {
            setMeta(null);
          }
        } else {
          showNotification(data.error?.message || t('emailAccess.listLoadError'), 'error');
        }
      } catch {
        showNotification(t('emailAccess.listLoadError'), 'error');
      } finally {
        setLoading(false);
      }
    },
    [apiUrl, savedSecretKey, showNotification, t]
  );

  useEffect(() => {
    if (!savedSecretKey) return;
    loadSettings();
  }, [savedSecretKey, loadSettings]);

  useEffect(() => {
    if (!savedSecretKey || tab !== 'allow') return;
    fetchList('allow', allowPage);
  }, [savedSecretKey, tab, allowPage, fetchList]);

  useEffect(() => {
    if (!savedSecretKey || tab !== 'block') return;
    fetchList('block', blockPage);
  }, [savedSecretKey, tab, blockPage, fetchList]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!savedSecretKey) return;
    setSettingsSaving(true);
    try {
      const res = await fetch(apiUrl('/api/email-access/settings'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Secret-API-Key': savedSecretKey,
        },
        body: JSON.stringify({
          signup_access_mode: signupMode,
          evaluate_blocklist_on_login: evalBlockOnLogin,
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setSettings(data.data);
        showNotification(t('emailAccess.settingsSaved'), 'success');
      } else {
        showNotification(data.error?.message || t('emailAccess.settingsError'), 'error');
      }
    } catch {
      showNotification(t('emailAccess.settingsError'), 'error');
    } finally {
      setSettingsSaving(false);
    }
  };

  const openAdd = (kind: 'allow' | 'block') => {
    setAddListKind(kind);
    setFormEntryType('email');
    setFormSegmentPreset('all');
    setFormSegmentCustom('');
    setFormValue('');
    setFormNote('');
    setAddOpen(true);
  };

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!savedSecretKey || !formValue.trim()) return;
    const accessSegment: string =
      formSegmentPreset === 'custom' ? formSegmentCustom.trim().toLowerCase() : formSegmentPreset;
    if (formSegmentPreset === 'custom') {
      if (!accessSegment || !SEGMENT_CUSTOM_RE.test(accessSegment)) {
        showNotification(t('emailAccess.segmentCustomError'), 'error');
        return;
      }
    }
    const path =
      addListKind === 'allow' ? '/api/email-access/allowlist' : '/api/email-access/blocklist';
    setFormSubmitting(true);
    try {
      const res = await fetch(apiUrl(path), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Secret-API-Key': savedSecretKey,
        },
        body: JSON.stringify({
          entry_type: formEntryType,
          value: formValue.trim(),
          note: formNote.trim(),
          access_segment: accessSegment,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification(t('emailAccess.entryCreated'), 'success');
        setAddOpen(false);
        if (addListKind === 'allow') {
          setAllowPage(0);
          fetchList('allow', 0);
        } else {
          setBlockPage(0);
          fetchList('block', 0);
        }
      } else {
        showNotification(data.error?.message || t('emailAccess.entryCreateError'), 'error');
      }
    } catch {
      showNotification(t('emailAccess.entryCreateError'), 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!savedSecretKey || !deleteTarget) return;
    const path =
      deleteTarget.kind === 'allow'
        ? `/api/email-access/allowlist/${encodeURIComponent(deleteTarget.id)}`
        : `/api/email-access/blocklist/${encodeURIComponent(deleteTarget.id)}`;
    setDeleteLoading(true);
    try {
      const res = await fetch(apiUrl(path), {
        method: 'DELETE',
        headers: { 'X-Secret-API-Key': savedSecretKey },
      });
      const data = await res.json();
      if (data.success) {
        const kind = deleteTarget.kind;
        showNotification(t('emailAccess.entryDeleted'), 'success');
        setDeleteOpen(false);
        setDeleteTarget(null);
        if (kind === 'allow') fetchList('allow', allowPage);
        else fetchList('block', blockPage);
      } else {
        showNotification(data.error?.message || t('emailAccess.entryDeleteError'), 'error');
      }
    } catch {
      showNotification(t('emailAccess.entryDeleteError'), 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const tabBtn = (id: Tab, label: string) => (
    <Button
      type="button"
      variant={tab === id ? 'primary' : 'secondary'}
      size="md"
      className="rounded-full"
      onClick={() => setTab(id)}
    >
      {label}
    </Button>
  );

  const renderList = (
    kind: 'allow' | 'block',
    rows: EmailAccessEntryView[],
    loading: boolean,
    page: number,
    meta: { totalPages: number; total: number } | null,
    setPage: (n: number) => void
  ) => {
    const totalPages = meta?.totalPages ?? 1;
    return (
      <Card className="border-border/60">
        <CardHeader
          className="items-center p-6 pb-4"
          actions={
            <Button
              variant="primary"
              size="md"
              onClick={() => openAdd(kind)}
              leading={<Icon icon={Plus} size={14} />}
            >
              {t('emailAccess.addEntry')}
            </Button>
          }
        >
          <div>
            <Heading level={2} visual="h3">
              {kind === 'allow' ? t('emailAccess.tabAllow') : t('emailAccess.tabBlock')}
            </Heading>
            {meta != null && (
              <Text tone="secondary" className="mt-1">
                {t('emailAccess.totalEntries', { count: meta.total })}
              </Text>
            )}
          </div>
        </CardHeader>
        <CardBody className="p-6 pt-0">
          {loading ? (
            <div className="py-16 flex justify-center">
              <Spinner size={20} label={t('common.loading')} className="text-text-muted" />
            </div>
          ) : rows.length === 0 ? (
            <Text tone="muted" className="py-8 text-center">{t('emailAccess.emptyList')}</Text>
          ) : (
            <>
              <Table className="rounded-none border-0 bg-transparent">
                <TableHeader className="bg-transparent">
                  <TableRow>
                    <TableHead>{t('emailAccess.colType')}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t('emailAccess.colSegment')}</TableHead>
                    <TableHead>{t('emailAccess.colValue')}</TableHead>
                    <TableHead className="hidden md:table-cell">{t('emailAccess.colNote')}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t('emailAccess.colCreated')}</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Badge className="font-mono">
                          {row.entry_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge variant="outline" className="font-mono">
                          {row.access_segment || 'all'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono">{row.value_normalized}</TableCell>
                      <TableCell className="hidden md:table-cell max-w-[200px] truncate text-text-secondary">
                        {row.note || '—'}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-caption text-text-muted">
                        {new Date(row.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <IconButton
                          icon={Trash2}
                          label={t('emailAccess.deleteEntry')}
                          variant="destructive-subtle"
                          onClick={() => {
                            setDeleteTarget({ kind, id: row.id });
                            setDeleteOpen(true);
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
                <Text variant="caption" tone="muted">
                  {t('emailAccess.page')} {page + 1} {t('emailAccess.of')} {totalPages}
                </Text>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    disabled={page <= 0}
                    onClick={() => setPage(page - 1)}
                    leading={<Icon icon={ChevronLeft} size={14} />}
                  >
                    {t('emailAccess.prev')}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage(page + 1)}
                    trailing={<Icon icon={ChevronRight} size={14} />}
                  >
                    {t('emailAccess.next')}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardBody>
      </Card>
    );
  };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <Heading level={1} className="flex items-center gap-3">
              <Icon icon={ListFilter} size={20} className="text-primary" />
              {t('sidebar.emailAccess')}
            </Heading>
            <Text tone="secondary" className="mt-1">{t('emailAccess.desc')}</Text>
            <Text variant="caption" tone="muted" className="mt-2 block max-w-2xl">{t('emailAccess.descSeg')}</Text>
          </div>
          <div className="flex gap-2">
            {savedSecretKey && (
              <Button
                variant="secondary"
                size="lg"
                onClick={openTestDialog}
                leading={<Icon icon={PlayCircle} size={16} />}
              >
                Probar email
              </Button>
            )}
            {!savedSecretKey && (
              <Link
                href={settingsHref}
                className={cn(
                  buttonVariants({ variant: 'secondary', size: 'lg' }),
                  'gap-2 border-amber-500/20 text-amber-500 hover:bg-amber-500/10'
                )}
              >
                <Icon icon={Key} size={16} /> {t('emailAccess.configSecretKey')}
              </Link>
            )}
          </div>
        </div>

        {!savedSecretKey ? (
          <Card className="border-amber-500/20">
            <EmptyState
              icon={Key}
              title={<span className="text-amber-300">{t('emailAccess.secretKeyRequired')}</span>}
              description={t('emailAccess.secretKeyRequiredDesc')}
              action={
                <Link href={settingsHref} className={cn(buttonVariants({ variant: 'primary', size: 'lg' }))}>
                  {t('users.goToSettings')}
                </Link>
              }
            />
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="px-6 py-3 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-center gap-2 text-xs text-emerald-400">
              <Icon icon={ShieldCheck} size={16} />
              <span>
                {t('roles.consultingWith')}{' '}
                <span className="font-mono">{truncateKey(savedSecretKey)}</span>
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {tabBtn('settings', t('emailAccess.tabSettings'))}
              {tabBtn('allow', t('emailAccess.tabAllow'))}
              {tabBtn('block', t('emailAccess.tabBlock'))}
            </div>

            {tab === 'settings' && (
              <Card>
                <CardHeader className="p-6 pb-4">
                  <Heading level={2} visual="h3">{t('emailAccess.tabSettings')}</Heading>
                  <Text tone="secondary">
                    {t('emailAccess.desc')}
                    {settings?.app_id ? (
                      <span className="mt-2 block font-mono text-code text-text-muted">
                        app_id: {settings.app_id}
                      </span>
                    ) : null}
                  </Text>
                </CardHeader>
                <CardBody className="p-6 pt-0">
                  {settingsLoading && !settings ? (
                    <div className="py-12 flex justify-center">
                      <Spinner size={20} label={t('common.loading')} className="text-text-muted" />
                    </div>
                  ) : (
                    <form onSubmit={handleSaveSettings} className="space-y-8 max-w-lg">
                      <FormField label={t('emailAccess.signupMode')}>
                        <Select
                          value={signupMode}
                          onValueChange={(v) => setSignupMode((v ?? 'open') as 'open' | 'allowlist_required')}
                          items={[
                            { value: 'open', label: t('emailAccess.modeOpen') },
                            { value: 'allowlist_required', label: t('emailAccess.modeAllowlist') },
                          ]}
                        />
                      </FormField>

                      <div className="rounded-xl border border-border/60 p-4">
                        <Switch
                          id="eval-block"
                          checked={evalBlockOnLogin}
                          onCheckedChange={setEvalBlockOnLogin}
                          label={t('emailAccess.evalBlockOnLogin')}
                          description={t('emailAccess.evalBlockOnLoginHint')}
                        />
                      </div>

                      <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        disabled={settingsSaving}
                        leading={settingsSaving ? <Spinner size={16} label={null} /> : undefined}
                      >
                        {settingsSaving ? t('emailAccess.savingSettings') : t('emailAccess.saveSettings')}
                      </Button>
                    </form>
                  )}
                </CardBody>
              </Card>
            )}

            {tab === 'allow' &&
              renderList('allow', allowRows, allowLoading, allowPage, allowMeta, setAllowPage)}
            {tab === 'block' &&
              renderList('block', blockRows, blockLoading, blockPage, blockMeta, setBlockPage)}
          </div>
        )}
      </motion.div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent size="md" className="sm:max-w-lg">
          <form onSubmit={handleCreateEntry}>
            <DialogHeader>
              <DialogTitle>{t('emailAccess.addEntryTitle')}</DialogTitle>
              <DialogDescription>
                {addListKind === 'allow' ? t('emailAccess.tabAllow') : t('emailAccess.tabBlock')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <FormField label={t('emailAccess.entryType')}>
                <Select
                  value={formEntryType}
                  onValueChange={(v) => setFormEntryType((v ?? 'email') as 'email' | 'domain')}
                  items={[
                    { value: 'email', label: t('emailAccess.typeEmail') },
                    { value: 'domain', label: t('emailAccess.typeDomain') },
                  ]}
                />
              </FormField>
              <FormField
                label={t('emailAccess.accessSegmentLabel')}
                description={t('emailAccess.segmentHint')}
              >
                <Select
                  value={formSegmentPreset}
                  onValueChange={(v) => setFormSegmentPreset((v ?? 'all') as SegmentPreset)}
                  items={[
                    { value: 'all', label: t('emailAccess.segmentAll') },
                    { value: 'email', label: t('emailAccess.segmentEmail') },
                    { value: 'google', label: t('emailAccess.segmentGoogle') },
                    { value: 'apple', label: t('emailAccess.segmentApple') },
                    { value: 'microsoft', label: t('emailAccess.segmentMicrosoft') },
                    { value: 'github', label: t('emailAccess.segmentGithub') },
                    { value: 'custom', label: t('emailAccess.segmentCustom') },
                  ]}
                />
                {formSegmentPreset === 'custom' && (
                  <Input
                    id="ea-seg-custom"
                    value={formSegmentCustom}
                    onChange={(e) => setFormSegmentCustom(e.target.value)}
                    placeholder={t('emailAccess.segmentCustomPlaceholder')}
                    className="font-mono"
                    autoComplete="off"
                  />
                )}
              </FormField>
              <FormField label={t('emailAccess.value')}>
                <Input
                  id="ea-value"
                  value={formValue}
                  onChange={(e) => setFormValue(e.target.value)}
                  placeholder={
                    formEntryType === 'email'
                      ? t('emailAccess.valuePlaceholderEmail')
                      : t('emailAccess.valuePlaceholderDomain')
                  }
                  className="font-mono"
                  required
                />
              </FormField>
              <FormField label={t('emailAccess.note')}>
                <Textarea
                  id="ea-note"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  rows={2}
                />
              </FormField>
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" size="lg" onClick={() => setAddOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={formSubmitting}
                leading={formSubmitting ? <Spinner size={16} label={null} /> : undefined}
              >
                {formSubmitting ? t('emailAccess.creating') : t('emailAccess.createEntry')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('emailAccess.deleteEntry')}</DialogTitle>
            <DialogDescription>{t('emailAccess.confirmDelete')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="secondary" size="lg" onClick={() => setDeleteOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" variant="destructive" size="lg" onClick={confirmDelete} loading={deleteLoading}>
              {t('emailAccess.deleteEntry')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Probar email</DialogTitle>
            <DialogDescription>
              Simula la evaluación contra las reglas actuales sin tocar usuarios reales.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <FormField label="Email">
              <Input
                id="ea-test-email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="user@example.com"
                className="font-mono"
                disabled={testLoading}
              />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Canal">
                <Select
                  value={testSegment}
                  onValueChange={(v) => setTestSegment((v ?? 'email') as typeof testSegment)}
                  items={[
                    { value: 'email', label: 'Email/password' },
                    { value: 'google', label: 'Google' },
                    { value: 'microsoft', label: 'Microsoft' },
                    { value: 'apple', label: 'Apple' },
                    { value: 'github', label: 'GitHub' },
                  ]}
                />
              </FormField>
              <FormField label="Flujo">
                <Select
                  value={testFlow}
                  onValueChange={(v) => setTestFlow((v ?? 'registration') as typeof testFlow)}
                  items={[
                    { value: 'registration', label: 'Registro (signup)' },
                    { value: 'login', label: 'Login (existente)' },
                  ]}
                />
              </FormField>
            </div>
            {testResult && (
              <div
                className={cn(
                  'rounded-md border p-3 text-sm',
                  testResult.allowed
                    ? 'border-emerald-500/40 bg-emerald-500/5'
                    : 'border-red-500/40 bg-red-500/5',
                )}
              >
                <div className="flex items-center gap-2 font-medium">
                  {testResult.allowed ? (
                    <>
                      <Icon icon={ShieldCheck} size={16} className="text-emerald-500" />
                      Permitido
                    </>
                  ) : (
                    <>
                      <Icon icon={ShieldOff} size={16} className="text-red-500" />
                      Bloqueado
                    </>
                  )}
                </div>
                {testResult.scope && (
                  <div className="mt-1 text-xs text-text-muted">
                    scope: <code className="font-mono">{testResult.scope}</code>
                  </div>
                )}
                {testResult.reason && (
                  <div className="mt-1 text-xs text-text-muted">{testResult.reason}</div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" size="lg" onClick={() => setTestOpen(false)} disabled={testLoading}>
              Cerrar
            </Button>
            <Button type="button" variant="primary" size="lg" onClick={runEmailAccessTest} loading={testLoading}>
              Evaluar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
