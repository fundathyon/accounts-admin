'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Copy } from 'lucide-react';
import {
  Alert,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Text,
} from '@foundathyon/community-ui';
import { StatusBadge } from '@/components/fdn/badge';
import { Button, IconButton, buttonVariants } from '@/components/fdn/button';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { countryFlag } from '@/lib/countries';
import {
  EVENT_TYPE_STATUS,
  blockReasonText,
  eventCountryName,
  eventTypeLabel,
  formatDateTime,
  geoSourceText,
  methodLabel,
  type LoginEvent,
} from '@/lib/login-events';
import { buildAdminHref, cn } from '@/lib/utils';

function Row({ label, value, mono, copy }: { label: string; value: ReactNode; mono?: boolean; copy?: string }) {
  const { t } = useI18n();
  const { showNotification } = useAdmin();
  const copyValue = async () => {
    if (typeof value !== 'string') return;
    try {
      await navigator.clipboard.writeText(value);
      showNotification(t('accessLog.detail.copied', { what: copy ?? label }), 'success');
    } catch {
      showNotification(t('accessLog.detail.copyFailed'), 'error');
    }
  };
  return (
    <div className="flex items-start justify-between gap-4">
      <Text variant="body-sm" tone="muted" className="shrink-0">{label}</Text>
      <span className="flex min-w-0 items-center justify-end gap-1">
        <span className={cn('min-w-0 text-right', mono ? 'break-all font-mono text-body-sm' : 'break-words')}>
          {value || '—'}
        </span>
        {copy && value ? (
          <IconButton
            icon={Copy}
            label={t('accessLog.detail.copy', { what: copy })}
            variant="ghost"
            size="xs"
            onClick={copyValue}
          />
        ) : null}
      </span>
    </div>
  );
}

/** One sign-in: who, when, from where and, if it did not go through, why. */
export function LoginEventDetailDialog({
  event,
  userEmail,
  onClose,
}: {
  event: LoginEvent | null;
  userEmail?: string;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const reason = event ? blockReasonText(t, event.block_reason) : null;
  const country = event?.country_code
    ? `${countryFlag(event.country_code)} ${eventCountryName(event.country_code, event.country_name, locale, t)} (${event.country_code})`
    : '';
  const source = event?.geo_source ? geoSourceText(t, event.geo_source) : null;
  return (
    <Dialog open={event !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg" className="max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t('accessLog.detail.title')}
            {event && <StatusBadge status={EVENT_TYPE_STATUS[event.type]}>{eventTypeLabel(t, event.type)}</StatusBadge>}
          </DialogTitle>
        </DialogHeader>
        {event && (
          <div className="space-y-4">
            {reason && (
              <Alert
                tone="warning"
                title={t(event.type === 'login_failed' ? 'accessLog.detail.failed' : 'accessLog.detail.blocked', {
                  reason: reason.title,
                })}
              >
                {reason.detail}
              </Alert>
            )}
            {event.type === 'ip_changed' && <Alert tone="info" title={t('accessLog.detail.ipChanged')} />}
            <div className="space-y-3">
              <Row label={t('accessLog.detail.date')} value={formatDateTime(event.created_at, locale)} />
              {userEmail && <Row label={t('accessLog.detail.user')} value={userEmail} />}
              <Row label={t('accessLog.detail.userId')} value={event.user_id} mono copy={t('accessLog.detail.userId')} />
              <Row label={t('accessLog.detail.method')} value={methodLabel(t, event.method, event.provider)} />
              <Row label={t('accessLog.detail.country')} value={country} />
              <Row label={t('accessLog.detail.region')} value={event.region} />
              <Row label={t('accessLog.detail.city')} value={event.city} />
              {source && (
                <Row
                  label={t('accessLog.detail.geoSource')}
                  value={
                    <>
                      <span className="block">{source.label}</span>
                      <Text variant="body-sm" tone="muted" className="block">{source.detail}</Text>
                    </>
                  }
                />
              )}
              <Row label={t('accessLog.table.columns.ip')} value={event.ip} mono copy={t('accessLog.table.columns.ip')} />
              <Row label={t('accessLog.detail.device')} value={event.device_name} />
              <Row label={t('accessLog.detail.userAgent')} value={event.user_agent} mono />
              <Row label={t('accessLog.detail.sessionId')} value={event.session_id} mono />
              <Row label={t('accessLog.detail.eventId')} value={event.id} mono />
            </div>
          </div>
        )}
        <DialogFooter>
          {event?.user_id && (
            <Link href={buildAdminHref(`/users/${event.user_id}`)} className={cn(buttonVariants({ variant: 'ghost' }))}>
              {t('accessLog.detail.viewUser')}
            </Link>
          )}
          <Button variant="secondary" onClick={onClose}>{t('common.close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
