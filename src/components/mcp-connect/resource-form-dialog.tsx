'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { FileJson, Plus, Upload, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Icon,
  Input,
  Select,
  Switch,
  Text,
  Textarea,
} from '@foundathyon/community-ui';
import { Button, IconButton, buttonVariants } from '@/components/fdn/button';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import type { Envelope } from '@/lib/api-envelope';
import {
  DEFAULT_ACCESS_TTL_SECONDS,
  DEFAULT_REDIRECT_DOMAINS,
  MAX_ACCESS_TTL_SECONDS,
  MIN_ACCESS_TTL_SECONDS,
  errorMessage,
  type McpResource,
} from '@/lib/mcp-connect';
import {
  EMPTY_SCOPE,
  draftsToDocument,
  entriesToDrafts,
  parseScopesDocument,
  splitList,
  type ScopeDraft,
} from '@/lib/mcp-scopes';
import { cn } from '@/lib/utils';
import { SectionTitle } from './section-title';

/** Shared form for registering and editing (`editing === null` registers). */
export function ResourceFormDialog({
  open,
  editing,
  resources,
  secretKey,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: McpResource | null;
  /** All the servers, to copy scopes from another one. */
  resources: McpResource[];
  secretKey: string;
  onClose: () => void;
  /** `created` is the new server, so its detail can open. */
  onSaved: (created: McpResource | null) => void;
}) {
  const { apiUrl, showNotification } = useAdmin();
  const { t } = useI18n();

  const [url, setUrl] = useState('');
  const [loginUrl, setLoginUrl] = useState('');
  const [name, setName] = useState('');
  const [ttl, setTtl] = useState(String(DEFAULT_ACCESS_TTL_SECONDS));
  const [cimd, setCimd] = useState(true);
  const [dcr, setDcr] = useState(true);
  const [domains, setDomains] = useState(DEFAULT_REDIRECT_DOMAINS);
  const [scopes, setScopes] = useState<ScopeDraft[]>([]);
  // Importing scopes: a panel inside the form, with per-row errors before applying.
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Reset when the dialog opens, for the server it opens on.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setUrl(editing?.resource_url ?? '');
      setLoginUrl(editing?.login_url ?? '');
      setName(editing?.name ?? '');
      setTtl(String(editing?.access_ttl_seconds ?? DEFAULT_ACCESS_TTL_SECONDS));
      setCimd(editing?.cimd_enabled ?? true);
      setDcr(editing?.dcr_enabled ?? true);
      setDomains(editing ? (editing.allowed_redirect_domains ?? []).join(', ') : DEFAULT_REDIRECT_DOMAINS);
      // Empty on purpose when registering: with no scopes, Accounts creates a single one.
      setScopes(entriesToDrafts(editing?.scopes ?? []));
      setImportOpen(false);
      setImportText('');
      setImportErrors([]);
    }
  }

  const otherResources = useMemo(
    () => resources.filter((r) => r.id !== editing?.id && (r.scopes ?? []).length > 0),
    [resources, editing],
  );

  const updateScope = (index: number, patch: Partial<ScopeDraft>) => {
    setScopes((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const applyImport = (text: string) => {
    const parsed = parseScopesDocument(text, t);
    if (!parsed.ok) {
      setImportErrors(parsed.errors);
      return;
    }
    setScopes(parsed.drafts);
    setImportErrors([]);
    setImportText('');
    setImportOpen(false);
    const count = parsed.drafts.length;
    showNotification(t(count === 1 ? 'mcpConnect.import.loadedOne' : 'mcpConnect.import.loadedMany', { count }), 'success');
  };

  const importFromFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      applyImport(await file.text());
    } catch {
      setImportErrors([t('mcpConnect.import.readFailed')]);
    }
  };

  const copyScopesFrom = (source: McpResource) => {
    const drafts = entriesToDrafts(source.scopes ?? []);
    setScopes(drafts);
    setImportErrors([]);
    setImportOpen(false);
    const count = drafts.length;
    showNotification(
      t(count === 1 ? 'mcpConnect.import.copiedOne' : 'mcpConnect.import.copiedMany', { count, source: source.name || source.resource_url }),
      'success',
    );
  };

  const send = (path: string, method: string, body: unknown) =>
    fetch(apiUrl(path), {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Secret-API-Key': secretKey },
      body: JSON.stringify(body),
    });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const resourceUrl = url.trim();
    const login = loginUrl.trim();
    if (!resourceUrl || !login) {
      showNotification(t('mcpConnect.form.urlsRequired'), 'error');
      return;
    }
    const seconds = Number(ttl);
    if (!Number.isInteger(seconds) || seconds < MIN_ACCESS_TTL_SECONDS || seconds > MAX_ACCESS_TTL_SECONDS) {
      showNotification(t('mcpConnect.form.ttlRange'), 'error');
      return;
    }
    const scopeList = draftsToDocument(scopes).scopes;
    if (scopeList.some((s) => !s.key || !s.label)) {
      showNotification(t('mcpConnect.form.scopeRequired'), 'error');
      return;
    }
    const base = {
      name: name.trim(),
      resource_url: resourceUrl,
      login_url: login,
      access_ttl_seconds: seconds,
      cimd_enabled: cimd,
      dcr_enabled: dcr,
      allowed_redirect_domains: splitList(domains),
    };
    setSubmitting(true);
    try {
      if (editing) {
        const path = `/api/mcp-connect/resources/${encodeURIComponent(editing.id)}`;
        const res = await send(path, 'PATCH', base);
        if (!res.ok) {
          const json = (await res.json().catch(() => null)) as Envelope | null;
          showNotification(errorMessage(json, t('mcpConnect.form.updateFailed')), 'error');
          return;
        }
        // Scopes have their own route, which replaces the whole list.
        if (scopeList.length > 0) {
          const scopesRes = await send(`${path}/scopes`, 'PUT', { scopes: scopeList });
          if (!scopesRes.ok) {
            const json = (await scopesRes.json().catch(() => null)) as Envelope | null;
            showNotification(errorMessage(json, t('mcpConnect.form.scopesSaveFailed')), 'error');
            return;
          }
        }
        showNotification(t('mcpConnect.form.updated'), 'success');
        onSaved(null);
      } else {
        const res = await send('/api/mcp-connect/resources', 'POST', scopeList.length > 0 ? { ...base, scopes: scopeList } : base);
        const json = (await res.json().catch(() => null)) as (Envelope & { data?: McpResource }) | null;
        if (!res.ok) {
          showNotification(errorMessage(json, t('mcpConnect.form.registerFailed')), 'error');
          return;
        }
        showNotification(t('mcpConnect.form.registered'), 'success');
        onSaved(json?.data ?? null);
      }
      onClose();
    } catch {
      showNotification(t('securityScreens.networkError'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent size="lg" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? t('mcpConnect.form.titleEdit') : t('mcpConnect.register')}</DialogTitle>
          <DialogDescription>{t('mcpConnect.form.description')}</DialogDescription>
        </DialogHeader>
        <form className="space-y-5" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField className="sm:col-span-2" label={t('mcpConnect.form.url')} description={t('mcpConnect.form.urlHint')}>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t('mcpConnect.form.urlPlaceholder')}
                autoComplete="off"
                className="font-mono"
              />
            </FormField>
            <FormField className="sm:col-span-2" label={t('mcpConnect.form.loginUrl')} description={t('mcpConnect.form.loginUrlHint')}>
              <Input
                value={loginUrl}
                onChange={(e) => setLoginUrl(e.target.value)}
                placeholder={t('mcpConnect.form.loginUrlPlaceholder')}
                autoComplete="off"
                className="font-mono"
              />
            </FormField>
            <FormField label={t('mcpConnect.form.displayName')}>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('mcpConnect.form.optional')} autoComplete="off" />
            </FormField>
            <FormField label={t('mcpConnect.form.ttl')}>
              <Input inputMode="numeric" value={ttl} onChange={(e) => setTtl(e.target.value)} />
            </FormField>
          </div>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <SectionTitle>{t('mcpConnect.form.scopesTitle')}</SectionTitle>
                <Text variant="body-sm" tone="muted" as="p">{t('mcpConnect.form.scopesHint')}</Text>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  leading={<Icon icon={Upload} size={14} />}
                  onClick={() => setImportOpen((v) => !v)}
                  aria-expanded={importOpen}
                >
                  {t('mcpConnect.import.button')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  leading={<Icon icon={Plus} size={14} />}
                  onClick={() => setScopes((prev) => [...prev, { ...EMPTY_SCOPE }])}
                >
                  {t('mcpConnect.form.addScope')}
                </Button>
              </div>
            </div>
            {importOpen && (
              <div className="space-y-3 rounded-md border border-border p-3">
                <Text variant="body-sm" tone="muted" as="p">{t('mcpConnect.import.hint')}</Text>
                <Textarea
                  aria-label={t('mcpConnect.import.jsonLabel')}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={t('mcpConnect.import.jsonPlaceholder')}
                  rows={5}
                  className="font-mono"
                />
                {importErrors.length > 0 && (
                  <ul className="list-disc space-y-0.5 pl-5 text-body-sm text-danger">
                    {importErrors.map((err) => (
                      <li key={err}>{err}</li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    leading={<Icon icon={FileJson} size={14} />}
                    onClick={() => applyImport(importText)}
                    disabled={!importText.trim()}
                  >
                    {t('mcpConnect.import.apply')}
                  </Button>
                  <label className={cn(buttonVariants({ variant: 'secondary' }), 'cursor-pointer gap-2')}>
                    <Icon icon={Upload} size={14} />
                    {t('mcpConnect.import.upload')}
                    <input
                      type="file"
                      accept="application/json,.json"
                      className="sr-only"
                      aria-label={t('mcpConnect.import.fileLabel')}
                      onChange={(e) => {
                        importFromFile(e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {otherResources.length > 0 && (
                    <Select
                      aria-label={t('mcpConnect.import.copyFromLabel')}
                      placeholder={t('mcpConnect.import.copyFromPlaceholder')}
                      items={otherResources.map((r) => ({
                        value: r.id,
                        label: `${r.name || r.resource_url} (${(r.scopes ?? []).length})`,
                      }))}
                      value={null}
                      onValueChange={(v) => {
                        const source = otherResources.find((r) => r.id === v);
                        if (source) copyScopesFrom(source);
                      }}
                    />
                  )}
                </div>
              </div>
            )}
            {scopes.map((scope, index) => {
              const n = index + 1;
              return (
                <div key={index} className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[1fr_1.4fr_auto]">
                  <Input
                    aria-label={t('mcpConnect.form.scopeKey', { n })}
                    value={scope.key}
                    onChange={(e) => updateScope(index, { key: e.target.value })}
                    placeholder={t('mcpConnect.form.scopeKeyPlaceholder')}
                    autoComplete="off"
                    className="font-mono"
                  />
                  <Input
                    aria-label={t('mcpConnect.form.scopeText', { n })}
                    value={scope.label}
                    onChange={(e) => updateScope(index, { label: e.target.value })}
                    placeholder={t('mcpConnect.form.scopeTextPlaceholder')}
                    autoComplete="off"
                  />
                  <IconButton
                    icon={X}
                    label={t('mcpConnect.form.scopeRemove', { n })}
                    variant="ghost"
                    type="button"
                    onClick={() => setScopes((prev) => prev.filter((_, i) => i !== index))}
                  />
                  <Input
                    aria-label={t('mcpConnect.form.scopeDescription', { n })}
                    value={scope.description}
                    onChange={(e) => updateScope(index, { description: e.target.value })}
                    placeholder={t('mcpConnect.form.scopeDescriptionPlaceholder')}
                    autoComplete="off"
                    wrapperClassName="sm:col-span-3"
                  />
                  <Input
                    aria-label={t('mcpConnect.form.scopeRoles', { n })}
                    value={scope.roles}
                    onChange={(e) => updateScope(index, { roles: e.target.value })}
                    placeholder={t('mcpConnect.form.scopeRolesPlaceholder')}
                    autoComplete="off"
                    wrapperClassName="sm:col-span-2"
                  />
                  <Switch
                    label={t('mcpConnect.form.writes')}
                    checked={scope.isWrite}
                    onCheckedChange={(isWrite) => updateScope(index, { isWrite })}
                  />
                </div>
              );
            })}
          </section>

          <section className="space-y-3">
            <SectionTitle>{t('mcpConnect.form.clientsTitle')}</SectionTitle>
            <Switch label={t('mcpConnect.form.cimd')} checked={cimd} onCheckedChange={setCimd} />
            <Switch label={t('mcpConnect.form.dcr')} checked={dcr} onCheckedChange={setDcr} />
            <FormField label={t('mcpConnect.form.domains')} description={t('mcpConnect.form.domainsHint')}>
              <Input value={domains} onChange={(e) => setDomains(e.target.value)} autoComplete="off" />
            </FormField>
          </section>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>{t('common.cancel')}</Button>
            <Button type="submit" variant="primary" loading={submitting}>
              {editing ? t('common.save') : t('mcpConnect.form.submitRegister')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
