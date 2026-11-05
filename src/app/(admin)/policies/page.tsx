'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Lock, Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  Card,
  CardBody,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Heading,
  Icon,
  Input,
  Radio,
  RadioGroup,
  Select,
  Spinner,
  Text,
  Textarea,
  type DataTableColumn,
} from '@foundathyon/community-ui';
import { AdminDataTable } from '@/components/admin-data-table';
import { Badge } from '@/components/fdn/badge';
import { Button, IconButton } from '@/components/fdn/button';
import { RichMessage } from '@/components/security-screen/rich-message';
import { ScreenNotes, SectionHeading } from '@/components/security-screen/screen-parts';
import { ScreenLoadError } from '@/components/security-screen/screen-states';
import { SecurityScreen } from '@/components/security-screen/security-screen';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { apiError, type Envelope } from '@/lib/api-envelope';
import type { Translate } from '@/lib/i18n/types';
import {
  listFromEnvelope,
  normalizePolicy,
  policyTarget,
  validatePolicy,
  type Policy,
  type PolicyEffect,
  type PolicyInput,
} from '@/lib/policies';
import { buildAdminHref } from '@/lib/utils';

type Role = { id: string; name: string };

const PAGE_SIZE = 10;
const EFFECT_VALUES: PolicyEffect[] = ['allow', 'deny'];
const EMPTY_FORM: PolicyInput = { name: '', description: '', resource: '', action: '', effect: 'allow' };

function failMessage(t: Translate, json: Envelope | null, status: number, fallback: string): string {
  if (status === 409) return t('policies.duplicate');
  return apiError(json)?.message || t('policies.withStatus', { message: fallback, status });
}

function EffectBadge({ effect }: { effect: PolicyEffect }) {
  const { t } = useI18n();
  return <Badge tone={effect === 'deny' ? 'danger' : 'success'}>{t(`policies.effect.${effect}`)}</Badge>;
}

function PolicyFormDialog({
  open,
  editing,
  secretKey,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: Policy | null;
  secretKey: string;
  onClose: () => void;
  onSaved: (policy: Policy | null, input: PolicyInput) => void;
}) {
  const { apiUrl, showNotification } = useAdmin();
  const { t } = useI18n();
  const [form, setForm] = useState<PolicyInput>(EMPTY_FORM);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reset when the dialog opens, for the policy it opens on.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setForm(editing ?? EMPTY_FORM);
      setError('');
    }
  }

  const submit = async () => {
    const input: PolicyInput = {
      name: form.name.trim(),
      description: form.description.trim(),
      resource: form.resource.trim(),
      action: form.action.trim(),
      effect: form.effect,
    };
    const invalid = validatePolicy(input, t);
    if (invalid) {
      setError(invalid);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(apiUrl(editing ? `/api/policies/${encodeURIComponent(editing.id)}` : '/api/policies'), {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Secret-API-Key': secretKey },
        body: JSON.stringify(input),
      });
      const json = (await res.json().catch(() => null)) as Envelope | null;
      if (!res.ok || json?.success === false) {
        setError(failMessage(t, json, res.status, t(editing ? 'policies.saveFailed' : 'policies.createFailed')));
        return;
      }
      const returned = json?.data && typeof json.data === 'object' ? normalizePolicy(json.data) : null;
      onSaved(returned?.id ? returned : null, input);
      showNotification(t(editing ? 'policies.updated' : 'policies.created'), 'success');
      onClose();
    } catch {
      setError(t('securityScreens.networkError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? t('policies.dialog.editTitle') : t('policies.dialog.newTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <FormField label={t('policies.dialog.name')}>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t('policies.dialog.namePlaceholder')}
              autoComplete="off"
            />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label={t('policies.dialog.resource')}>
              <Input
                value={form.resource}
                onChange={(e) => setForm({ ...form, resource: e.target.value })}
                placeholder={t('policies.dialog.resourcePlaceholder')}
                autoComplete="off"
                className="font-mono"
              />
            </FormField>
            <FormField label={t('policies.dialog.action')}>
              <Input
                value={form.action}
                onChange={(e) => setForm({ ...form, action: e.target.value })}
                placeholder={t('policies.dialog.actionPlaceholder')}
                autoComplete="off"
                className="font-mono"
              />
            </FormField>
          </div>
          <div className="space-y-2">
            <Text id="policy-effect-label" as="p" className="font-medium">{t('policies.dialog.effect')}</Text>
            <RadioGroup
              aria-labelledby="policy-effect-label"
              value={form.effect}
              onValueChange={(v) => setForm({ ...form, effect: v === 'deny' ? 'deny' : 'allow' })}
            >
              {EFFECT_VALUES.map((value) => (
                <Radio
                  key={value}
                  value={value}
                  label={t(`policies.dialog.effectOption.${value}.label`)}
                  description={t(`policies.dialog.effectOption.${value}.description`)}
                />
              ))}
            </RadioGroup>
          </div>
          <FormField label={t('policies.dialog.description')}>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t('policies.dialog.descriptionPlaceholder')}
              rows={2}
            />
          </FormField>
          {error && (
            <Text role="alert" variant="body-sm" as="p" className="text-danger">{error}</Text>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={submit} loading={submitting}>
            {editing ? t('common.save') : t('policies.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PoliciesEditor({ secretKey }: { secretKey: string }) {
  const { apiUrl, showNotification } = useAdmin();
  const { t } = useI18n();

  const [search, setSearch] = useState('');
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Policy | null>(null);
  const [deleting, setDeleting] = useState<Policy | null>(null);

  const [roleId, setRoleId] = useState('');
  const [rolePolicies, setRolePolicies] = useState<Policy[]>([]);
  const [roleLoading, setRoleLoading] = useState(false);
  const [roleError, setRoleError] = useState('');
  const [toAssign, setToAssign] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const headers = useMemo(() => ({ 'X-Secret-API-Key': secretKey }), [secretKey]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [policiesRes, rolesRes] = await Promise.all([
        fetch(apiUrl('/api/policies?page=0&size=100&offset=0'), { headers, cache: 'no-store' }),
        fetch(apiUrl('/api/roles?page=0&size=100&offset=0'), { headers, cache: 'no-store' }),
      ]);
      const policiesJson = (await policiesRes.json().catch(() => null)) as Envelope | null;
      if (!policiesRes.ok) {
        setLoadError(failMessage(t, policiesJson, policiesRes.status, t('policies.loadFailed')));
        return;
      }
      setPolicies(listFromEnvelope(policiesJson).map(normalizePolicy).filter((p) => p.id));
      const rolesJson = (await rolesRes.json().catch(() => null)) as Envelope | null;
      if (rolesRes.ok) {
        const list = listFromEnvelope(rolesJson)
          .map((r) => r as Record<string, unknown>)
          .map((r) => ({ id: String(r.id ?? ''), name: String(r.name ?? '') }))
          .filter((r) => r.id);
        setRoles(list);
        // The role of `?role=`, or the first one.
        const wanted = new URLSearchParams(window.location.search).get('role');
        setRoleId((current) => current || (list.some((r) => r.id === wanted) ? (wanted as string) : (list[0]?.id ?? '')));
      }
    } catch {
      setLoadError(t('securityScreens.networkError'));
    } finally {
      setLoading(false);
    }
  }, [apiUrl, headers, t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!roleId) return;
    let cancelled = false;
    setToAssign('');
    setRoleLoading(true);
    setRoleError('');
    fetch(apiUrl(`/api/role-policies/${encodeURIComponent(roleId)}`), { headers, cache: 'no-store' })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as Envelope | null;
        if (cancelled) return;
        if (!res.ok) {
          setRolePolicies([]);
          setRoleError(failMessage(t, json, res.status, t('policies.roleLoadFailed')));
          return;
        }
        setRolePolicies(listFromEnvelope(json).map(normalizePolicy).filter((p) => p.id));
      })
      .catch(() => {
        if (!cancelled) setRoleError(t('securityScreens.networkError'));
      })
      .finally(() => {
        if (!cancelled) setRoleLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiUrl, headers, roleId, t]);

  const columns = useMemo<DataTableColumn<Policy>[]>(
    () => [
      {
        id: 'name',
        header: t('policies.columns.name'),
        type: 'text',
        primary: true,
        sortable: true,
        width: '200px',
        accessor: (p) => p.name || p.id,
      },
      {
        id: 'target',
        header: t('policies.columns.target'),
        accessor: (p) => policyTarget(p),
        cell: (p) => <span className="font-mono text-body-sm">{policyTarget(p)}</span>,
      },
      {
        id: 'effect',
        header: t('policies.columns.effect'),
        sortable: true,
        accessor: (p) => p.effect,
        cell: (p) => <EffectBadge effect={p.effect} />,
      },
      {
        id: 'description',
        header: t('policies.columns.description'),
        type: 'text',
        hideBelow: 'md',
        accessor: (p) => p.description || null,
      },
    ],
    [t],
  );

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (policy: Policy) => {
    setEditing(policy);
    setFormOpen(true);
  };

  const onSaved = async (returned: Policy | null, input: PolicyInput) => {
    if (editing) {
      const next: Policy = { ...editing, ...input, ...(returned ?? {}) };
      setPolicies((prev) => prev.map((p) => (p.id === editing.id ? next : p)));
      setRolePolicies((prev) => prev.map((p) => (p.id === editing.id ? next : p)));
    } else if (returned) {
      setPolicies((prev) => [...prev, returned]);
    } else {
      await load();
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      const res = await fetch(apiUrl(`/api/policies/${encodeURIComponent(deleting.id)}`), { method: 'DELETE', headers });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as Envelope | null;
        showNotification(failMessage(t, json, res.status, t('policies.deleteFailed')), 'error');
        return;
      }
      setPolicies((prev) => prev.filter((p) => p.id !== deleting.id));
      setRolePolicies((prev) => prev.filter((p) => p.id !== deleting.id));
      showNotification(t('policies.deleted'), 'success');
      setDeleting(null);
    } catch {
      showNotification(t('securityScreens.networkError'), 'error');
    }
  };

  const assign = async () => {
    if (!roleId || !toAssign) return;
    setAssigning(true);
    try {
      const res = await fetch(apiUrl('/api/role-policies'), {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_id: roleId, policy_id: toAssign }),
      });
      const json = (await res.json().catch(() => null)) as Envelope | null;
      if (!res.ok || json?.success === false) {
        showNotification(failMessage(t, json, res.status, t('policies.assignFailed')), 'error');
        return;
      }
      const policy = policies.find((p) => p.id === toAssign);
      if (policy) setRolePolicies((prev) => (prev.some((p) => p.id === policy.id) ? prev : [...prev, policy]));
      setToAssign('');
      showNotification(t('policies.assigned'), 'success');
    } catch {
      showNotification(t('securityScreens.networkError'), 'error');
    } finally {
      setAssigning(false);
    }
  };

  const unassign = async (policy: Policy) => {
    if (!roleId) return;
    setRemovingId(policy.id);
    try {
      const res = await fetch(
        apiUrl(`/api/role-policies/${encodeURIComponent(roleId)}/${encodeURIComponent(policy.id)}`),
        { method: 'DELETE', headers },
      );
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as Envelope | null;
        showNotification(failMessage(t, json, res.status, t('policies.unassignFailed')), 'error');
        return;
      }
      setRolePolicies((prev) => prev.filter((p) => p.id !== policy.id));
      showNotification(t('policies.unassigned'), 'success');
    } catch {
      showNotification(t('securityScreens.networkError'), 'error');
    } finally {
      setRemovingId(null);
    }
  };

  const roleItems = useMemo(() => roles.map((r) => ({ value: r.id, label: r.name || r.id })), [roles]);
  const assignItems = useMemo(() => {
    const assigned = new Set(rolePolicies.map((p) => p.id));
    return policies
      .filter((p) => !assigned.has(p.id))
      .map((p) => ({ value: p.id, label: `${p.name} · ${policyTarget(p)} · ${t(`policies.effect.${p.effect}`)}` }));
  }, [policies, rolePolicies, t]);
  const selectedRole = roles.find((r) => r.id === roleId);

  if (loadError) return <ScreenLoadError message={loadError} onRetry={load} />;

  return (
    <div className="space-y-6">
      <ScreenNotes
        notes={[
          <RichMessage key="what" text={t('policies.rules.what')} />,
          <RichMessage key="deny" text={t('policies.rules.denyWins')} />,
          <RichMessage key="match" text={t('policies.rules.noMatchDenies')} />,
        ]}
      />

      <section className="space-y-3">
        <Heading level={2} visual="h3">{t('policies.section.policies')}</Heading>
        <AdminDataTable<Policy>
          entity={t('policies.entity')}
          columns={columns}
          data={policies}
          rowId={(p) => p.id}
          loading={loading}
          loadingRowCount={5}
          search={{ value: search, onChange: setSearch, placeholder: t('policies.searchPlaceholder') }}
          globalFilter={search}
          sorting={{ defaultState: { id: 'name', direction: 'asc' } }}
          pageSize={PAGE_SIZE}
          toolbarEnd={
            <Button variant="primary" leading={<Icon icon={Plus} size={14} />} onClick={openCreate} disabled={loading}>
              {t('policies.newPolicy')}
            </Button>
          }
          rowActions={(p) => [
            { label: t('policies.actions.edit'), icon: Pencil, onSelect: () => openEdit(p) },
            { label: t('policies.actions.delete'), icon: Trash2, destructive: true, onSelect: () => setDeleting(p) },
          ]}
          emptyState={{ icon: Lock, title: t('policies.empty.title'), description: t('policies.empty.description') }}
          noResultsState={{ title: t('policies.noResults.title'), description: t('policies.noResults.description') }}
        />
      </section>

      {!loading && (
        <section className="space-y-3">
          <SectionHeading title={t('policies.byRole.title')} description={t('policies.byRole.description')} />
          {roles.length === 0 ? (
            <Card>
              <CardBody>
                <Text variant="body-sm" tone="muted" as="p">
                  <RichMessage
                    text={t('policies.byRole.noRoles')}
                    link={(content) => (
                      <Link href={buildAdminHref('/roles-policies')} className="font-medium text-accent hover:underline">
                        {content}
                      </Link>
                    )}
                  />
                </Text>
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardBody className="space-y-4">
                <Select
                  aria-label={t('policies.byRole.roleAria')}
                  items={roleItems}
                  value={roleId}
                  onValueChange={(v) => setRoleId(v ?? '')}
                  className="w-full sm:w-[280px]"
                />
                {roleLoading ? (
                  <Text variant="body-sm" tone="muted" as="p" className="flex items-center gap-2">
                    <Spinner size={14} label={t('policies.byRole.loading')} /> {t('policies.byRole.loading')}
                  </Text>
                ) : roleError ? (
                  <Text variant="body-sm" as="p" className="text-danger">{roleError}</Text>
                ) : rolePolicies.length === 0 ? (
                  <Text variant="body-sm" tone="muted" as="p" className="rounded-md border border-border px-3 py-2">
                    {t('policies.byRole.noPolicies', { name: selectedRole?.name ?? t('policies.byRole.thisRole') })}
                  </Text>
                ) : (
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {rolePolicies.map((p) => (
                      <li key={p.id} className="flex items-center gap-3 px-3 py-2 text-body-sm">
                        <EffectBadge effect={p.effect} />
                        <span className="min-w-0 flex-1 truncate">
                          <span className="font-medium">{p.name || p.id}</span>{' '}
                          <span className="font-mono text-text-muted">{policyTarget(p)}</span>
                        </span>
                        <IconButton
                          icon={X}
                          label={t('policies.byRole.remove', { name: p.name || p.id })}
                          variant="ghost"
                          disabled={removingId === p.id}
                          onClick={() => unassign(p)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Select
                    aria-label={t('policies.byRole.assignAria')}
                    items={assignItems}
                    value={toAssign || null}
                    onValueChange={(v) => setToAssign(v ?? '')}
                    placeholder={assignItems.length === 0 ? t('policies.byRole.noneLeft') : t('policies.byRole.choose')}
                    disabled={assignItems.length === 0 || roleLoading}
                    className="w-full sm:w-[420px]"
                  />
                  <Button
                    variant="secondary"
                    leading={<Icon icon={Plus} size={14} />}
                    disabled={!toAssign}
                    loading={assigning}
                    onClick={assign}
                  >
                    {t('policies.byRole.assign')}
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}
        </section>
      )}

      <PolicyFormDialog
        open={formOpen}
        editing={editing}
        secretKey={secretKey}
        onClose={() => setFormOpen(false)}
        onSaved={onSaved}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t('policies.deleteDialog.title')}
        description={<RichMessage text={t('policies.deleteDialog.body', { name: deleting?.name ?? '' })} />}
        verb={t('policies.deleteDialog.confirm')}
        cancelLabel={t('common.cancel')}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

export default function PoliciesPage() {
  const { t } = useI18n();
  return (
    <SecurityScreen title={t('policies.title')} description={t('policies.subtitle')}>
      {(secretKey) => <PoliciesEditor key={secretKey} secretKey={secretKey} />}
    </SecurityScreen>
  );
}
