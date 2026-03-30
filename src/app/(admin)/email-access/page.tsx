'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Key,
  ShieldCheck,
  Loader2,
  ListFilter,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { BASE_PATH, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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
      variant={tab === id ? 'default' : 'outline'}
      size="sm"
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
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-lg">
              {kind === 'allow' ? t('emailAccess.tabAllow') : t('emailAccess.tabBlock')}
            </CardTitle>
            {meta != null && (
              <CardDescription className="mt-1">
                {t('emailAccess.totalEntries', { count: meta.total })}
              </CardDescription>
            )}
          </div>
          <Button size="sm" className="gap-2" onClick={() => openAdd(kind)}>
            <Plus className="w-4 h-4" />
            {t('emailAccess.addEntry')}
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">{t('emailAccess.emptyList')}</p>
          ) : (
            <>
              <Table>
                <TableHeader>
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
                        <Badge variant="secondary" className="font-mono text-xs">
                          {row.entry_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge variant="outline" className="font-mono text-xs">
                          {row.access_segment || 'all'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{row.value_normalized}</TableCell>
                      <TableCell className="hidden md:table-cell max-w-[200px] truncate text-muted-foreground text-sm">
                        {row.note || '—'}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                        {new Date(row.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            setDeleteTarget({ kind, id: row.id });
                            setDeleteOpen(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  {t('emailAccess.page')} {page + 1} {t('emailAccess.of')} {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page <= 0}
                    onClick={() => setPage(page - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    {t('emailAccess.prev')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage(page + 1)}
                  >
                    {t('emailAccess.next')}
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <ListFilter className="w-8 h-8 text-primary" />
              {t('sidebar.emailAccess')}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">{t('emailAccess.desc')}</p>
            <p className="text-muted-foreground text-xs mt-2 max-w-2xl">{t('emailAccess.descSeg')}</p>
          </div>
          {!savedSecretKey && (
            <Button variant="outline" asChild className="gap-2 border-amber-500/20 text-amber-500 hover:bg-amber-500/10">
              <Link href={settingsHref}>
                <Key className="w-4 h-4" /> {t('emailAccess.configSecretKey')}
              </Link>
            </Button>
          )}
        </div>

        {!savedSecretKey ? (
          <Card className="border-amber-500/20 p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
              <Key className="w-8 h-8 text-amber-400" />
            </div>
            <CardTitle className="text-amber-300 mb-2">{t('emailAccess.secretKeyRequired')}</CardTitle>
            <CardDescription className="mb-6">{t('emailAccess.secretKeyRequiredDesc')}</CardDescription>
            <Button asChild>
              <Link href={settingsHref}>{t('users.goToSettings')}</Link>
            </Button>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="px-6 py-3 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-center gap-2 text-xs text-emerald-400">
              <ShieldCheck className="w-4 h-4 shrink-0" />
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
                <CardHeader>
                  <CardTitle>{t('emailAccess.tabSettings')}</CardTitle>
                  <CardDescription>
                    {t('emailAccess.desc')}
                    {settings?.app_id ? (
                      <span className="mt-2 block font-mono text-xs text-muted-foreground">
                        app_id: {settings.app_id}
                      </span>
                    ) : null}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {settingsLoading && !settings ? (
                    <div className="py-12 flex justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <form onSubmit={handleSaveSettings} className="space-y-8 max-w-lg">
                      <div className="space-y-2">
                        <Label>{t('emailAccess.signupMode')}</Label>
                        <Select
                          value={signupMode}
                          onValueChange={(v) => setSignupMode(v as 'open' | 'allowlist_required')}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">{t('emailAccess.modeOpen')}</SelectItem>
                            <SelectItem value="allowlist_required">
                              {t('emailAccess.modeAllowlist')}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 p-4">
                        <div className="space-y-1">
                          <Label htmlFor="eval-block" className="text-base">
                            {t('emailAccess.evalBlockOnLogin')}
                          </Label>
                          <p className="text-xs text-muted-foreground">{t('emailAccess.evalBlockOnLoginHint')}</p>
                        </div>
                        <Switch
                          id="eval-block"
                          checked={evalBlockOnLogin}
                          onCheckedChange={setEvalBlockOnLogin}
                        />
                      </div>

                      <Button type="submit" disabled={settingsSaving} className="gap-2">
                        {settingsSaving ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {t('emailAccess.savingSettings')}
                          </>
                        ) : (
                          t('emailAccess.saveSettings')
                        )}
                      </Button>
                    </form>
                  )}
                </CardContent>
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
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleCreateEntry}>
            <DialogHeader>
              <DialogTitle>{t('emailAccess.addEntryTitle')}</DialogTitle>
              <DialogDescription>
                {addListKind === 'allow' ? t('emailAccess.tabAllow') : t('emailAccess.tabBlock')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>{t('emailAccess.entryType')}</Label>
                <Select
                  value={formEntryType}
                  onValueChange={(v) => setFormEntryType(v as 'email' | 'domain')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">{t('emailAccess.typeEmail')}</SelectItem>
                    <SelectItem value="domain">{t('emailAccess.typeDomain')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('emailAccess.accessSegmentLabel')}</Label>
                <Select
                  value={formSegmentPreset}
                  onValueChange={(v) => setFormSegmentPreset(v as SegmentPreset)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('emailAccess.segmentAll')}</SelectItem>
                    <SelectItem value="email">{t('emailAccess.segmentEmail')}</SelectItem>
                    <SelectItem value="google">{t('emailAccess.segmentGoogle')}</SelectItem>
                    <SelectItem value="apple">{t('emailAccess.segmentApple')}</SelectItem>
                    <SelectItem value="microsoft">{t('emailAccess.segmentMicrosoft')}</SelectItem>
                    <SelectItem value="github">{t('emailAccess.segmentGithub')}</SelectItem>
                    <SelectItem value="custom">{t('emailAccess.segmentCustom')}</SelectItem>
                  </SelectContent>
                </Select>
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
                <p className="text-xs text-muted-foreground">{t('emailAccess.segmentHint')}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ea-value">{t('emailAccess.value')}</Label>
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
              </div>
              <div className="space-y-2">
                <Label htmlFor="ea-note">{t('emailAccess.note')}</Label>
                <textarea
                  id="ea-note"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  rows={2}
                  className={cn(
                    'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs',
                    'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                  )}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={formSubmitting}>
                {formSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    {t('emailAccess.creating')}
                  </>
                ) : (
                  t('emailAccess.createEntry')
                )}
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
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" variant="destructive" onClick={confirmDelete} disabled={deleteLoading}>
              {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('emailAccess.deleteEntry')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
