'use client';

import { Text, Tooltip } from '@foundathyon/community-ui';
import { Badge, type BadgeProps } from '@/components/fdn/badge';
import { useI18n } from '@/context/i18n-context';
import {
  formatCount,
  geoSourceBreakdown,
  geoSourceText,
  type GeoSource,
  type GeoSourceCounts,
} from '@/lib/login-events';

const TONE: Record<GeoSource, BadgeProps['tone']> = {
  database: 'neutral',
  headers: 'info',
  none: 'warning',
};

/** Where the location of a sign-in came from, explained in the tooltip. */
export function GeoSourceBadge({ source }: { source: GeoSource | '' }) {
  const { t } = useI18n();
  if (!source) return null;
  const text = geoSourceText(t, source);
  return (
    <Tooltip content={text.detail}>
      <span tabIndex={0} className="inline-flex shrink-0">
        <Badge tone={TONE[source]}>{text.label}</Badge>
      </span>
    </Tooltip>
  );
}

/** "Ubicación: 92 % base de datos · 6 % headers · 2 % sin datos", under the totals. */
export function GeoSourceBreakdown({ sources }: { sources: GeoSourceCounts }) {
  const { t, locale } = useI18n();
  const parts = geoSourceBreakdown(sources);
  if (parts.length === 0) return null;
  return (
    <Text variant="body-sm" tone="muted" as="p">
      {t('accessLog.events.locationLabel')}{' '}
      {parts.map((p, i) => (
        <span key={p.source}>
          {i > 0 ? ' · ' : null}
          <Tooltip
            content={t(p.count === 1 ? 'accessLog.events.sourceTooltipOne' : 'accessLog.events.sourceTooltipMany', {
              detail: geoSourceText(t, p.source).detail,
              count: formatCount(p.count, locale),
            })}
          >
            <span tabIndex={0} className="underline decoration-dotted underline-offset-2">
              {p.percent} {t(`accessLog.events.geoSourceShort.${p.source}`)}
            </span>
          </Tooltip>
        </span>
      ))}
    </Text>
  );
}
