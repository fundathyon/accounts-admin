'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Pencil, Plug, Trash2 } from 'lucide-react';
import { ConfirmDialog, Icon, type DataTableColumn } from '@foundathyon/community-ui';
import { AdminDataTable } from '@/components/admin-data-table';
import { StatusBadge } from '@/components/fdn/badge';
import { Button } from '@/components/fdn/button';
import { ResourceDetailDialog } from '@/components/mcp-connect/resource-detail-dialog';
import { ResourceFormDialog } from '@/components/mcp-connect/resource-form-dialog';
import { RichMessage } from '@/components/security-screen/rich-message';
import { ScreenLoadError, ScreenUnavailable } from '@/components/security-screen/screen-states';
import { SecurityScreen } from '@/components/security-screen/security-screen';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import type { Envelope } from '@/lib/api-envelope';
import { downloadText, errorMessage, type McpResource, type VerifyReport } from '@/lib/mcp-connect';
import { documentToText, draftsToDocument, entriesToDrafts, exportFileName } from '@/lib/mcp-scopes';

const PAGE_SIZE = 10;

function McpConnectEditor({ secretKey }: { secretKey: string }) {
  const { apiUrl, showNotification } = useAdmin();
  const { t } = useI18n();

  const [resources, setResources] = useState<McpResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notEnabled, setNotEnabled] = useState(false);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<McpResource | null>(null);
  const [detail, setDetail] = useState<McpResource | null>(null);
  const [deleting, setDeleting] = useState<McpResource | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(apiUrl('/api/mcp-connect/resources'), {
        headers: { 'X-Secret-API-Key': secretKey },
        cache: 'no-store',
      });
      // Without OAUTH_PUBLIC_URL, Accounts does not mount these routes.
      if (res.status === 404) {
        setNotEnabled(true);
        return;
      }
      const json = (await res.json().catch(() => null)) as (Envelope & { data?: McpResource[] }) | null;
      if (!res.ok) {
        setLoadError(errorMessage(json, t('mcpConnect.loadFailed', { status: res.status })));
        return;
      }
      setNotEnabled(false);
      setResources(Array.isArray(json?.data) ? json.data : []);
    } catch {
      setLoadError(t('securityScreens.networkError'));
    } finally {
      setLoading(false);
    }
  }, [apiUrl, secretKey, t]);

  useEffect(() => {
    load();
  }, [load]);

  const columns = useMemo<DataTableColumn<McpResource>[]>(
    () => [
      {
        id: 'name',
        header: t('mcpConnect.columns.name'),
        type: 'text',
        primary: true,
        sortable: true,
        width: '180px',
        accessor: (r) => r.name,
      },
      {
        id: 'resource_url',
        header: t('mcpConnect.columns.url'),
        width: '280px',
        accessor: (r) => r.resource_url,
        // Trimmed by hand: the `digest` type would show it as a hash.
        cell: (r) => (
          <span className="block max-w-[260px] truncate font-mono text-body-sm text-text-muted" title={r.resource_url}>
            {r.resource_url}
          </span>
        ),
      },
      {
        id: 'status',
        header: t('mcpConnect.columns.status'),
        sortable: true,
        accessor: (r) => (r.verified_at ? 'verified' : 'unverified'),
        cell: (r) => (
          <StatusBadge status={r.verified_at ? 'active' : 'pending'}>
            {r.verified_at ? t('mcpConnect.verified') : t('mcpConnect.unverified')}
          </StatusBadge>
        ),
      },
      { id: 'scopes', header: t('mcpConnect.columns.scopes'), type: 'number', accessor: (r) => r.scopes?.length ?? 0 },
      {
        id: 'created_at',
        header: t('mcpConnect.columns.created'),
        type: 'date',
        sortable: true,
        hideBelow: 'lg',
        accessor: (r) => r.created_at ?? null,
      },
    ],
    [t],
  );

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (resource: McpResource) => {
    setEditing(resource);
    setFormOpen(true);
  };

  const onSaved = async (created: McpResource | null) => {
    if (created) setDetail(created);
    await load();
  };

  const onVerified = (id: string, report: VerifyReport) => {
    const verifiedAt = report.verified ? (report.at ?? new Date().toISOString()) : null;
    const apply = (r: McpResource) => ({ ...r, verified_at: verifiedAt, verify_report: report });
    setDetail((prev) => (prev?.id === id ? apply(prev) : prev));
    setResources((prev) => prev.map((r) => (r.id === id ? apply(r) : r)));
  };

  /** Downloads the scopes as the JSON that PUT …/scopes takes. */
  const exportScopes = (resource: McpResource) => {
    const doc = draftsToDocument(entriesToDrafts(resource.scopes ?? []));
    downloadText(exportFileName(resource.name), documentToText(doc));
    showNotification(t('mcpConnect.exported'), 'success');
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      const res = await fetch(apiUrl(`/api/mcp-connect/resources/${encodeURIComponent(deleting.id)}`), {
        method: 'DELETE',
        headers: { 'X-Secret-API-Key': secretKey },
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as Envelope | null;
        showNotification(errorMessage(json, t('mcpConnect.delete.failed')), 'error');
        return;
      }
      setResources((prev) => prev.filter((r) => r.id !== deleting.id));
      showNotification(t('mcpConnect.delete.deleted'), 'success');
      setDeleting(null);
    } catch {
      showNotification(t('securityScreens.networkError'), 'error');
    }
  };

  if (notEnabled) {
    return <ScreenUnavailable title={t('mcpConnect.unavailable.title')} body={t('mcpConnect.unavailable.body')} />;
  }
  if (loadError) return <ScreenLoadError message={loadError} onRetry={load} />;

  return (
    <>
      <AdminDataTable<McpResource>
        entity={t('mcpConnect.entity')}
        columns={columns}
        data={resources}
        rowId={(r) => r.id}
        loading={loading}
        loadingRowCount={5}
        search={{ value: search, onChange: setSearch, placeholder: t('mcpConnect.searchPlaceholder') }}
        globalFilter={search}
        columnsButton
        sorting={{ defaultState: { id: 'created_at', direction: 'desc' } }}
        pageSize={PAGE_SIZE}
        toolbarEnd={
          <Button variant="primary" leading={<Icon icon={Plug} size={14} />} disabled={loading} onClick={openCreate}>
            {t('mcpConnect.register')}
          </Button>
        }
        onRowClick={setDetail}
        rowActions={(r) => [
          { label: t('mcpConnect.actions.view'), icon: Eye, onSelect: () => setDetail(r) },
          { label: t('common.edit'), icon: Pencil, onSelect: () => openEdit(r) },
          { label: t('common.delete'), icon: Trash2, destructive: true, onSelect: () => setDeleting(r) },
        ]}
        emptyState={{ icon: Plug, title: t('mcpConnect.empty.title'), description: t('mcpConnect.empty.description') }}
        noResultsState={{ title: t('mcpConnect.noResults.title'), description: t('mcpConnect.noResults.description') }}
      />

      <ResourceFormDialog
        open={formOpen}
        editing={editing}
        resources={resources}
        secretKey={secretKey}
        onClose={() => setFormOpen(false)}
        onSaved={onSaved}
      />

      <ResourceDetailDialog
        resource={detail}
        secretKey={secretKey}
        onClose={() => setDetail(null)}
        onVerified={onVerified}
        onExport={exportScopes}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t('mcpConnect.delete.title')}
        description={
          <RichMessage text={t('mcpConnect.delete.body', { name: deleting?.name ?? '', url: deleting?.resource_url ?? '' })} />
        }
        verb={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={confirmDelete}
      />
    </>
  );
}

export default function McpConnectPage() {
  const { t } = useI18n();
  return (
    <SecurityScreen title={t('mcpConnect.title')} description={t('mcpConnect.subtitle')}>
      {(secretKey) => <McpConnectEditor key={secretKey} secretKey={secretKey} />}
    </SecurityScreen>
  );
}
