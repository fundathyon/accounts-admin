'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Copy, Download, Search, ShieldCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Icon,
  Input,
  Select,
  Spinner,
  Text,
} from '@foundathyon/community-ui';
import { Badge, StatusBadge, type StatusBadgeProps } from '@/components/fdn/badge';
import { Button, IconButton } from '@/components/fdn/button';
import { RichMessage } from '@/components/security-screen/rich-message';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import type { Envelope } from '@/lib/api-envelope';
import {
  errorMessage,
  formatDate,
  isCheckName,
  isRevokedReason,
  personLabel,
  type ConnectionStatusFilter,
  type McpConnection,
  type McpResource,
  type VerifyCheck,
  type VerifyReport,
} from '@/lib/mcp-connect';
import { buildAdminHref, cn } from '@/lib/utils';
import { SectionTitle } from './section-title';

const CHECK_STATUS: Record<VerifyCheck['status'], StatusBadgeProps['status']> = {
  passed: 'active',
  failed: 'failed',
  skipped: 'unknown',
};

function DetailField({ label, value, onCopy, bordered }: { label: string; value: string; onCopy: () => void; bordered?: boolean }) {
  const { t } = useI18n();
  return (
    <div className={cn('flex items-start justify-between gap-3 px-3 py-2', bordered && 'border-t border-border')}>
      <div className="min-w-0">
        <Text variant="overline" tone="muted" as="p">{label}</Text>
        <p className="break-all font-mono text-body-sm">{value || '—'}</p>
      </div>
      {value && (
        <IconButton icon={Copy} label={t('mcpConnect.copy', { label })} variant="ghost" type="button" onClick={onCopy} className="shrink-0" />
      )}
    </div>
  );
}

/** A server: the values for it, its checks, its scopes and who connected. */
export function ResourceDetailDialog({
  resource,
  secretKey,
  onClose,
  onVerified,
  onExport,
}: {
  resource: McpResource | null;
  secretKey: string;
  onClose: () => void;
  onVerified: (id: string, report: VerifyReport) => void;
  onExport: (resource: McpResource) => void;
}) {
  const { apiUrl, showNotification } = useAdmin();
  const { t, locale } = useI18n();
  const [verifying, setVerifying] = useState(false);
  const [connections, setConnections] = useState<McpConnection[]>([]);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<ConnectionStatusFilter>('all');
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const loadConnections = useCallback(
    async (resourceId: string, filters: { email?: string; status?: ConnectionStatusFilter } = {}) => {
      setLoadingConnections(true);
      try {
        const query = new URLSearchParams({ resource_id: resourceId, size: '100' });
        const wanted = filters.email?.trim();
        if (wanted) query.set('email', wanted);
        if (filters.status && filters.status !== 'all') query.set('status', filters.status);
        const res = await fetch(apiUrl(`/api/mcp-connect/connections?${query}`), {
          headers: { 'X-Secret-API-Key': secretKey },
          cache: 'no-store',
        });
        const json = (await res.json().catch(() => null)) as { data?: { items?: McpConnection[] } } | null;
        setConnections(res.ok && Array.isArray(json?.data?.items) ? json.data.items : []);
      } catch {
        setConnections([]);
      } finally {
        setLoadingConnections(false);
      }
    },
    [apiUrl, secretKey],
  );

  const resourceId = resource?.id;
  const [prevId, setPrevId] = useState(resourceId);
  if (resourceId !== prevId) {
    setPrevId(resourceId);
    setConnections([]);
    setEmail('');
    setStatus('all');
  }

  useEffect(() => {
    if (resourceId) loadConnections(resourceId);
  }, [resourceId, loadConnections]);

  const copyValue = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      showNotification(t('mcpConnect.copied', { label }), 'success');
    } catch {
      showNotification(t('mcpConnect.copyFailed'), 'error');
    }
  };

  const verify = async () => {
    if (!resource) return;
    setVerifying(true);
    try {
      const res = await fetch(apiUrl(`/api/mcp-connect/resources/${encodeURIComponent(resource.id)}/verify`), {
        method: 'POST',
        headers: { 'X-Secret-API-Key': secretKey },
      });
      const json = (await res.json().catch(() => null)) as (Envelope & { data?: VerifyReport }) | null;
      if (!res.ok || !json?.data) {
        showNotification(errorMessage(json, t('mcpConnect.detail.verifyFailed')), 'error');
        return;
      }
      onVerified(resource.id, json.data);
      if (json.data.verified) showNotification(t('mcpConnect.detail.verifyOk'), 'success');
      else showNotification(t('mcpConnect.detail.verifyMissing'), 'error');
    } catch {
      showNotification(t('securityScreens.networkError'), 'error');
    } finally {
      setVerifying(false);
    }
  };

  const revoke = async (connection: McpConnection) => {
    setRevokingId(connection.id);
    try {
      const res = await fetch(apiUrl(`/api/mcp-connect/connections/${encodeURIComponent(connection.id)}`), {
        method: 'DELETE',
        headers: { 'X-Secret-API-Key': secretKey },
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as Envelope | null;
        showNotification(errorMessage(json, t('mcpConnect.detail.revokeFailed')), 'error');
        return;
      }
      setConnections((prev) =>
        prev.map((c) => (c.id === connection.id ? { ...c, status: 'revoked', revoked_reason: 'owner' } : c)),
      );
      showNotification(t('mcpConnect.detail.revoked'), 'success');
    } catch {
      showNotification(t('securityScreens.networkError'), 'error');
    } finally {
      setRevokingId(null);
    }
  };

  const search = (e: FormEvent) => {
    e.preventDefault();
    if (resource) loadConnections(resource.id, { email, status });
  };

  const checks = resource?.verify_report?.checks ?? [];

  return (
    <Dialog open={resource !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{resource?.name || t('mcpConnect.detail.fallbackTitle')}</DialogTitle>
          <DialogDescription>{t('mcpConnect.detail.description')}</DialogDescription>
        </DialogHeader>
        {resource && (
          <div className="space-y-5">
            <StatusBadge status={resource.verified_at ? 'active' : 'pending'}>
              {resource.verified_at ? t('mcpConnect.verified') : t('mcpConnect.unverified')}
            </StatusBadge>

            <section className="space-y-2">
              <SectionTitle>{t('mcpConnect.detail.values')}</SectionTitle>
              <div className="overflow-hidden rounded-md border border-border">
                <DetailField
                  label={t('mcpConnect.detail.issuer')}
                  value={resource.issuer}
                  onCopy={() => copyValue(t('mcpConnect.detail.issuerShort'), resource.issuer)}
                />
                <DetailField
                  label={t('mcpConnect.detail.resource')}
                  value={resource.resource_url}
                  onCopy={() => copyValue(t('mcpConnect.detail.resource'), resource.resource_url)}
                  bordered
                />
              </div>
              <Text variant="body-sm" tone="muted" as="p" className="break-words">
                <RichMessage text={t('mcpConnect.detail.valuesHint', { url: resource.protected_resource_metadata_url })} />
              </Text>
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <SectionTitle>{t('mcpConnect.detail.checks')}</SectionTitle>
                <Button variant="secondary" leading={<Icon icon={ShieldCheck} size={14} />} onClick={verify} loading={verifying}>
                  {t('mcpConnect.detail.verify')}
                </Button>
              </div>
              {checks.length === 0 ? (
                <Text tone="muted" as="p">{t('mcpConnect.detail.notVerified')}</Text>
              ) : (
                <ul className="space-y-2">
                  {checks.map((check) => (
                    <li key={check.name} className="flex items-start gap-3 rounded-md border border-border px-3 py-2">
                      <StatusBadge status={CHECK_STATUS[check.status]}>{t(`mcpConnect.detail.check.${check.status}`)}</StatusBadge>
                      <div className="min-w-0">
                        <Text as="p">{isCheckName(check.name) ? t(`mcpConnect.checks.${check.name}`) : check.name}</Text>
                        {check.status === 'failed' && (check.detail || check.found) && (
                          <Text variant="body-sm" tone="muted" as="p" className="break-all">
                            {check.detail}
                            {check.found ? ` ${t('mcpConnect.detail.found', { value: check.found })}` : ''}
                          </Text>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <SectionTitle>{t('mcpConnect.detail.scopes')}</SectionTitle>
                <Button
                  variant="secondary"
                  leading={<Icon icon={Download} size={14} />}
                  onClick={() => onExport(resource)}
                  disabled={(resource.scopes ?? []).length === 0}
                >
                  {t('mcpConnect.detail.exportJson')}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(resource.scopes ?? []).map((scope) => (
                  <Badge key={scope.key} variant="outline" className="font-mono" title={scope.label}>
                    {scope.key}
                  </Badge>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <SectionTitle>{t('mcpConnect.detail.connections')}</SectionTitle>
              <form className="flex flex-wrap items-center gap-2" onSubmit={search}>
                <Input
                  aria-label={t('mcpConnect.detail.searchLabel')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('mcpConnect.detail.searchPlaceholder')}
                  autoComplete="off"
                  wrapperClassName="min-w-0 flex-1"
                />
                <Select
                  aria-label={t('mcpConnect.detail.statusLabel')}
                  items={[
                    { value: 'all', label: t('mcpConnect.detail.filterAll') },
                    { value: 'active', label: t('mcpConnect.detail.filterActive') },
                    { value: 'revoked', label: t('mcpConnect.detail.filterRevoked') },
                  ]}
                  value={status}
                  onValueChange={(v) => {
                    const next = (v ?? 'all') as ConnectionStatusFilter;
                    setStatus(next);
                    loadConnections(resource.id, { email, status: next });
                  }}
                  className="w-[140px]"
                />
                <Button type="submit" variant="secondary" leading={<Icon icon={Search} size={14} />} disabled={loadingConnections}>
                  {t('mcpConnect.detail.search')}
                </Button>
              </form>
              {loadingConnections ? (
                <Text tone="muted" as="p" className="flex items-center gap-2">
                  <Spinner size={14} label={t('mcpConnect.detail.loadingConnections')} /> {t('mcpConnect.detail.loadingConnections')}
                </Text>
              ) : connections.length === 0 ? (
                <Text tone="muted" as="p">{t('mcpConnect.detail.noConnections')}</Text>
              ) : (
                <ul className="space-y-2">
                  {connections.map((connection) => (
                    <li key={connection.id} className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {personLabel(connection)}
                          {connection.user?.name && connection.user.email && (
                            <span className="font-normal text-text-muted"> · {connection.user.name}</span>
                          )}
                          {connection.user?.is_test && <Badge variant="outline" className="ml-2">{t('mcpConnect.detail.testUser')}</Badge>}
                        </p>
                        <Text variant="body-sm" tone="muted" as="p" className="truncate">
                          {t('mcpConnect.detail.connectionMeta', {
                            client: connection.client.name || connection.client.client_id,
                            scopes: connection.scope.join(', '),
                            granted: formatDate(connection.granted_at, locale),
                            lastUsed: formatDate(connection.last_used_at ?? connection.granted_at, locale),
                          })}
                        </Text>
                        <Link href={buildAdminHref(`/users/${connection.user_id}`)} className="text-body-sm text-accent underline-offset-2 hover:underline">
                          {t('mcpConnect.detail.viewUser')}
                        </Link>
                      </div>
                      <StatusBadge status={connection.status === 'active' ? 'active' : 'revoked'}>
                        {connection.status === 'active'
                          ? t('mcpConnect.detail.active')
                          : isRevokedReason(connection.revoked_reason ?? '')
                            ? t(`mcpConnect.detail.revokedReasons.${connection.revoked_reason}`)
                            : t('mcpConnect.detail.revokedDefault')}
                      </StatusBadge>
                      {connection.status === 'active' && (
                        <Button variant="destructive" onClick={() => revoke(connection)} loading={revokingId === connection.id}>
                          {t('mcpConnect.detail.revoke')}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
