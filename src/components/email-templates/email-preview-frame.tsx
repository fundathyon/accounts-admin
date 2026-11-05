'use client';

import { useEffect, useRef, useState } from 'react';
import { Spinner, Text } from '@foundathyon/community-ui';
import { useI18n } from '@/context/i18n-context';
import { cn } from '@/lib/utils';

export type PreviewDevice = 'desktop' | 'mobile';

const MIN_HEIGHT = 480;

/**
 * Shows a rendered email the way an inbox would: sender and subject on top,
 * the HTML below at desktop or phone width. The iframe grows with its content,
 * so on its own the page scrolls it. When a parent caps the frame's height
 * (the sticky preview next to the branding controls), the body scrolls instead
 * and the sender row stays put.
 *
 * The iframe gets `allow-same-origin` only so its height can be measured; it
 * never gets `allow-scripts`, so nothing in the email can run.
 */
export function EmailPreviewFrame({
  html,
  subject,
  fromName,
  sender,
  device = 'desktop',
  loading = false,
  className,
}: {
  html: string | null;
  subject?: string;
  fromName?: string;
  sender?: string;
  device?: PreviewDevice;
  loading?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState(MIN_HEIGHT);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    let observer: ResizeObserver | null = null;
    const measure = () => {
      const doc = frame.contentDocument;
      if (!doc?.documentElement) return;
      setHeight(Math.max(MIN_HEIGHT, doc.documentElement.scrollHeight));
    };
    const attach = () => {
      measure();
      observer?.disconnect();
      const root = frame.contentDocument?.documentElement;
      if (root && typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(measure);
        observer.observe(root);
      }
    };
    frame.addEventListener('load', attach);
    return () => {
      frame.removeEventListener('load', attach);
      observer?.disconnect();
    };
  }, []);

  const initial = (fromName || '?').trim().charAt(0).toUpperCase();

  return (
    <div className={cn('flex flex-col overflow-hidden rounded-lg border border-border bg-surface', className)}>
      {subject !== undefined && (
        <div className="flex shrink-0 items-start gap-3 border-b border-border px-4 py-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-hover text-body font-semibold text-text-secondary">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-1.5 text-body">
              <span className="font-semibold text-text">{fromName || '—'}</span>
              {sender && <span className="truncate text-text-muted">&lt;{sender}&gt;</span>}
            </div>
            <div className="truncate text-body text-text-secondary">{subject || '—'}</div>
          </div>
          {loading && <Spinner size={16} label={t('emailTemplates.previewFrame.updating')} className="mt-1 shrink-0 text-text-muted" />}
        </div>
      )}
      <div className="relative flex min-h-0 flex-1 justify-center overflow-y-auto bg-bg-subtle p-3">
        {/* White like a mail client's reading pane: this is the email's canvas, not the admin's. */}
        <iframe
          ref={frameRef}
          title={t('emailTemplates.previewFrame.title')}
          sandbox="allow-same-origin"
          className={cn(
            'block rounded-md border-0 transition-[width] duration-200',
            device === 'mobile' ? 'w-[390px] max-w-full shadow-sm' : 'w-full',
          )}
          style={{ height, backgroundColor: '#ffffff' }}
          srcDoc={html ?? ''}
        />
        {html === null && (
          <div className="absolute inset-0 flex items-center justify-center gap-2">
            <Spinner size={16} className="text-text-muted" />
            <Text tone="muted">{t('emailTemplates.previewFrame.generating')}</Text>
          </div>
        )}
      </div>
    </div>
  );
}
