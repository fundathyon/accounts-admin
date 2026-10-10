'use client';

import { useEffect, useRef, useState } from 'react';
import { Moon, RefreshCw, Sun } from 'lucide-react';
import { Alert, Badge, Button, IconButton, Spinner, Text } from '@foundathyon/community-ui';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { cn } from '@/lib/utils';
import { intersectStrategies } from '@/lib/embedded-auth';
import type { EmbeddedAuthConfig, EmbeddedAuthStrategies } from '@/lib/admin-types';
import { EmbeddedAuthMockPreview } from './embedded-auth-mock-preview';

/** How long the frame gets to evaluate the bundle and answer before falling back. */
const READY_TIMEOUT_MS = 8_000;
/** Debounce between a draft edit and the message that re-renders the component. */
const UPDATE_DEBOUNCE_MS = 200;
/** Any absolute URL works as the component's BASE_URL: no request leaves the frame. */
const PREVIEW_BASE_URL = 'https://accounts.preview.invalid';

type Status = 'loading' | 'live' | 'fallback';

/** JSON for an inline <script>: `<` escaped so no `</script>` can close the tag early. */
function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/**
 * The sandboxed preview document. The bundle travels INSIDE it (fetched by
 * the admin's BFF from the backend, server to server): an opaque-origin frame
 * cannot load scripts from localhost or a private network (Local Network
 * Access), and must not need to. Its bootstrap:
 *  1. replaces `fetch`, so the component reads the admin's DRAFT as its
 *     `GET /api/v1/embedded-auth/config` and nothing ever leaves the frame;
 *  2. evaluates the bundle once the parent sends the first config;
 *  3. remounts `<accounts-sign-in>` on every new config (after
 *     `Accounts.getConfig({refresh:true})`), and reports boot / ready / error /
 *     size to the parent. Messages are only accepted from the parent window.
 */
function buildSrcDoc(bundle: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;background:transparent}#root{display:block}</style>
</head><body><div id="root"></div>
<script>
(function () {
  'use strict';
  var BUNDLE = ${scriptJson(bundle)};
  var BASE = ${scriptJson(PREVIEW_BASE_URL)};
  var parentWin = window.parent;
  var config = null, attrs = {}, loaded = false;
  function post(msg) { try { parentWin.postMessage(msg, '*'); } catch (e) {} }
  function reply(status, body) {
    return Promise.resolve(new Response(JSON.stringify(body), { status: status, headers: { 'Content-Type': 'application/json' } }));
  }
  window.fetch = function (input) {
    var url = typeof input === 'string' ? input : (input && input.url) || String(input);
    if (config && url.indexOf('/api/v1/embedded-auth/config') !== -1) {
      return reply(200, { success: true, status_code: 200, data: config });
    }
    return reply(503, { success: false, status_code: 503, error: { code: 503, message: 'preview', scope: 'embedded_auth.preview' } });
  };
  function mount() {
    var root = document.getElementById('root');
    if (!root) return;
    root.textContent = '';
    var el = document.createElement('accounts-sign-in');
    Object.keys(attrs).forEach(function (k) { if (attrs[k]) el.setAttribute(k, String(attrs[k])); });
    root.appendChild(el);
  }
  function refresh() {
    var A = window.Accounts;
    var p = A && typeof A.getConfig === 'function' ? A.getConfig({ refresh: true }) : Promise.resolve();
    p.then(mount, mount);
  }
  function load() {
    loaded = true;
    var s = document.createElement('script');
    s.setAttribute('data-base-url', BASE);
    s.setAttribute('data-publishable-key', 'preview');
    s.setAttribute('data-persistence', 'memory');
    s.textContent = BUNDLE;
    document.head.appendChild(s);
    if (!window.Accounts || !window.customElements || !window.customElements.get('accounts-sign-in')) {
      post({ type: 'accounts-preview:error', reason: 'invalid' });
      return;
    }
    refresh();
    post({ type: 'accounts-preview:ready' });
  }
  window.addEventListener('message', function (e) {
    if (e.source !== parentWin) return;
    var d = e.data;
    if (!d || d.type !== 'accounts-preview:config') return;
    config = d.config;
    attrs = d.attrs || {};
    if (loaded) refresh(); else load();
  });
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(function () {
      post({ type: 'accounts-preview:size', height: Math.ceil(document.body.scrollHeight) });
    }).observe(document.body);
  }
  post({ type: 'accounts-preview:boot' });
})();
</script>
</body></html>`;
}

/** The public config (`GET /api/v1/embedded-auth/config`) the draft would produce. */
function previewConfig(config: EmbeddedAuthConfig, strategies: EmbeddedAuthStrategies) {
  return {
    app_id: 'preview',
    enabled: true,
    strategies: {
      password: { enabled: strategies.password },
      email_code: {
        enabled: strategies.email_code,
        code_size: 6,
        code_type: 'numeric',
        ttl_seconds: 600,
        resend_cooldown_seconds: 60,
        max_verify_attempts: 5,
      },
      magic_link: { enabled: strategies.magic_link, ttl_seconds: 900 },
      // Popups are blocked in the sandbox: the buttons render, nothing opens.
      oauth: strategies.oauth.map((provider) => ({ provider, start_url: 'about:blank' })),
    },
    signup: { enabled: strategies.password, verification_required: false },
    branding: { ...config.branding, name: config.branding.name.trim(), logo_url: config.branding.logo_url.trim() },
    hide_branding: config.hide_branding,
  };
}

interface EmbeddedAuthPreviewProps {
  /** The draft being edited (never saved state: the preview follows every keystroke). */
  config: EmbeddedAuthConfig;
  available: EmbeddedAuthStrategies;
  /** The admin's own scheme, used when the component follows the system theme. */
  adminScheme: 'light' | 'dark';
}

/**
 * Live preview of `<accounts-sign-in>`. It renders the REAL component — the
 * `/ui/v1/accounts.js` the backend serves, fetched through the admin's BFF —
 * inside a sandboxed iframe (scripts only, no same-origin: the bundle can
 * never read the admin's storage or keys) and feeds it the draft by
 * postMessage. When the backend does not serve the bundle (Community, the
 * mock server, an older Pro) it falls back to a static mock that follows the
 * design system.
 */
export function EmbeddedAuthPreview({ config, available, adminScheme }: EmbeddedAuthPreviewProps) {
  const { t } = useI18n();
  const { apiUrl } = useAdmin();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [attempt, setAttempt] = useState(0);
  // The bundle of one attempt: undefined while fetching, null when unavailable.
  const [bundleEntry, setBundleEntry] = useState<{ attempt: number; script: string | null } | null>(null);
  const [frameStatus, setFrameStatus] = useState<{ attempt: number; status: Status } | null>(null);
  const [schemeOverride, setSchemeOverride] = useState<'light' | 'dark' | null>(null);
  const [height, setHeight] = useState(520);

  useEffect(() => {
    let alive = true;
    fetch(apiUrl('/api/embedded-auth/bundle'), { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { data?: { script?: unknown } } | null) => {
        const script = typeof body?.data?.script === 'string' && body.data.script ? body.data.script : null;
        if (alive) setBundleEntry({ attempt, script });
      })
      .catch(() => {
        if (alive) setBundleEntry({ attempt, script: null });
      });
    return () => {
      alive = false;
    };
  }, [apiUrl, attempt]);

  const bundle = bundleEntry?.attempt === attempt ? bundleEntry.script : undefined;
  const status: Status =
    bundle === null ? 'fallback' : bundle === undefined ? 'loading' : frameStatus?.attempt === attempt ? frameStatus.status : 'loading';

  const followsSystem = config.branding.theme === 'system';
  const systemScheme = schemeOverride ?? adminScheme;
  const scheme = followsSystem ? systemScheme : config.branding.theme === 'dark' ? 'dark' : 'light';
  const strategies = intersectStrategies(config.strategies, available);

  const message = {
    type: 'accounts-preview:config',
    config: previewConfig(config, strategies),
    attrs: { theme: scheme, locale: config.branding.locale, layout: config.branding.layout },
  };
  const messageJson = JSON.stringify(message);
  const latestMessage = useRef(message);
  useEffect(() => {
    latestMessage.current = message;
  });

  // Messages from the frame: only from OUR iframe's window, only known types.
  useEffect(() => {
    if (!bundle) return;
    const onMessage = (event: MessageEvent) => {
      const frame = iframeRef.current?.contentWindow;
      if (!frame || event.source !== frame) return;
      const data = event.data as { type?: unknown; height?: unknown } | null;
      switch (data?.type) {
        case 'accounts-preview:boot':
          frame.postMessage(latestMessage.current, '*');
          break;
        case 'accounts-preview:ready':
          setFrameStatus({ attempt, status: 'live' });
          break;
        case 'accounts-preview:error':
          setFrameStatus({ attempt, status: 'fallback' });
          break;
        case 'accounts-preview:size':
          if (typeof data.height === 'number' && Number.isFinite(data.height)) {
            setHeight(Math.min(900, Math.max(360, Math.round(data.height))));
          }
          break;
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [bundle, attempt]);

  // No answer in time (a bundle that throws, a hung frame…) → static preview.
  useEffect(() => {
    if (!bundle) return;
    const id = window.setTimeout(() => {
      setFrameStatus((prev) => (prev?.attempt === attempt && prev.status !== 'loading' ? prev : { attempt, status: 'fallback' }));
    }, READY_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, [bundle, attempt]);

  // Every draft change re-renders the live component (debounced).
  useEffect(() => {
    if (status !== 'live') return;
    const id = window.setTimeout(() => {
      iframeRef.current?.contentWindow?.postMessage(JSON.parse(messageJson), '*');
    }, UPDATE_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [messageJson, status]);

  const srcDoc = bundle ? buildSrcDoc(bundle) : '';
  const showFrame = !!bundle && status !== 'fallback';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Text variant="label">{t('embeddedAuth.preview.title')}</Text>
          {status === 'live' && (
            <Badge tone="success" dot>
              {t('embeddedAuth.preview.live')}
            </Badge>
          )}
          {status === 'fallback' && <Badge tone="neutral">{t('embeddedAuth.preview.approximate')}</Badge>}
          {status === 'loading' && <Spinner size={14} label={t('embeddedAuth.preview.loading')} />}
        </div>
        {followsSystem && (
          <div className="flex items-center gap-1" role="group" aria-label={t('embeddedAuth.preview.scheme')}>
            <IconButton
              icon={Sun}
              size="sm"
              variant={systemScheme === 'light' ? 'secondary' : 'ghost'}
              label={t('embeddedAuth.preview.light')}
              aria-pressed={systemScheme === 'light'}
              onClick={() => setSchemeOverride('light')}
            />
            <IconButton
              icon={Moon}
              size="sm"
              variant={systemScheme === 'dark' ? 'secondary' : 'ghost'}
              label={t('embeddedAuth.preview.dark')}
              aria-pressed={systemScheme === 'dark'}
              onClick={() => setSchemeOverride('dark')}
            />
          </div>
        )}
      </div>

      <div className="relative">
        {status !== 'live' && (
          <EmbeddedAuthMockPreview
            branding={config.branding}
            hideBranding={config.hide_branding}
            strategies={strategies}
            scheme={scheme}
          />
        )}
        {showFrame && (
          <iframe
            key={attempt}
            ref={iframeRef}
            title={t('embeddedAuth.preview.frameTitle')}
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            srcDoc={srcDoc}
            style={{ height }}
            className={cn(
              'w-full rounded-xl border border-border bg-transparent',
              status === 'live' ? 'block' : 'pointer-events-none absolute inset-0 opacity-0'
            )}
          />
        )}
      </div>

      {status === 'fallback' && (
        <Alert
          tone="info"
          title={t('embeddedAuth.preview.unavailable')}
          action={
            <Button
              size="sm"
              variant="secondary"
              leading={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={() => setAttempt((n) => n + 1)}
            >
              {t('embeddedAuth.preview.reload')}
            </Button>
          }
        >
          {t('embeddedAuth.preview.unavailableDesc')}
        </Alert>
      )}
      <Text variant="caption" tone="muted" as="div">
        {t('embeddedAuth.preview.note')}
      </Text>
    </div>
  );
}
