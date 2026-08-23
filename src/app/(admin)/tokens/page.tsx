'use client';

import { useState, useMemo, useRef, useEffect, forwardRef } from 'react';
import type { ComponentProps, UIEvent } from 'react';
import {
  Key,
  Copy,
  Check,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Heading,
  Icon,
  IconButton,
  Inline,
  JsonViewer,
  Text,
  Tooltip,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@foundathyon/community-ui';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { cn } from '@/lib/utils';

function base64UrlDecode(str: string): string {
  try {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
    return decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } catch {
    return '';
  }
}

function decodeJwt(token: string): { header: Record<string, unknown>; payload: Record<string, unknown> } | null {
  const t = token.trim();
  if (!t) return null;
  const parts = t.split('.');
  if (parts.length !== 3) return null;
  try {
    const headerJson = base64UrlDecode(parts[0]);
    const payloadJson = base64UrlDecode(parts[1]);
    if (!headerJson || !payloadJson) return null;
    return {
      header: JSON.parse(headerJson) as Record<string, unknown>,
      payload: JSON.parse(payloadJson) as Record<string, unknown>,
    };
  } catch {
    return null;
  }
}

type ValidateState = {
  result: { is_valid: boolean; entity_type?: string };
} | null;

function splitJwtParts(value: string): [string, string, string] | null {
  const t = value.trim();
  if (!t) return null;
  const parts = t.split('.');
  if (parts.length !== 3) return null;
  return [parts[0], parts[1], parts[2]];
}

/**
 * JwtColoredView — decorative rendering of `header.payload.signature` where
 * each segment gets its own DS-token color. Kept local because the coloring
 * is JWT-specific (segments delimited by `.`, not language tokens), but the
 * palette maps to the same three-color rule as CodeBlock (§20): accent for
 * "the verb" (header), success for the payload (its meaningful body), info
 * for the signature ("just data").
 */
function JwtColoredView({
  value,
  className,
  asOverlay,
}: {
  value: string;
  className?: string;
  asOverlay?: boolean;
}) {
  const parts = splitJwtParts(value);
  if (!parts) {
    return <span className={className}>{value || ''}</span>;
  }
  const [header, payload, signature] = parts;
  return (
    <span
      className={cn(
        'font-mono text-code whitespace-pre-wrap break-all',
        asOverlay && 'pointer-events-none select-none',
        className
      )}
    >
      <span className="text-accent">{header}</span>
      <span className="text-text-muted">.</span>
      <span className="text-success">{payload}</span>
      <span className="text-text-muted">.</span>
      <span className="text-info">{signature}</span>
    </span>
  );
}

/**
 * JwtTextarea — editable field for a JWT with per-segment coloring. Follows
 * the same overlay+textarea pattern as `CodeEditor` and shares its frame
 * (`rounded-md border border-border bg-bg-subtle`), so it visually reads as
 * part of the same editor family instead of a one-off ad-hoc textarea.
 */
const JwtTextarea = forwardRef<
  HTMLTextAreaElement,
  Omit<ComponentProps<'textarea'>, 'value' | 'onChange'> & {
    value: string;
    onChange: (v: string) => void;
    wrapperClassName?: string;
  }
>(function JwtTextarea({ value, onChange, placeholder, className, wrapperClassName, ...props }, ref) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const syncScroll = (e: UIEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    const ov = overlayRef.current;
    if (ov) {
      ov.scrollTop = ta.scrollTop;
      ov.scrollLeft = ta.scrollLeft;
    }
  };

  return (
    <div
      className={cn(
        'group relative flex flex-1 min-h-[200px] flex-col overflow-hidden rounded-md border border-border bg-bg-subtle transition-colors duration-[var(--fdn-dur-fast)] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus',
        wrapperClassName
      )}
    >
      <div
        ref={overlayRef}
        className="absolute inset-0 overflow-auto px-3 py-2 leading-[1.125rem]"
        aria-hidden
      >
        <JwtColoredView value={value} asOverlay />
      </div>
      <textarea
        ref={ref}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        className={cn(
          'relative z-10 w-full flex-1 min-h-[200px] resize-none border-0 bg-transparent px-3 py-2 font-mono text-code text-transparent placeholder:text-text-muted placeholder:opacity-100 focus:outline-none',
          'selection:bg-focus/30 selection:text-transparent',
          'leading-[1.125rem]',
          className
        )}
        spellCheck={false}
        {...props}
        style={{
          ...(props as { style?: React.CSSProperties }).style,
          caretColor: 'var(--fdn-text)',
        }}
      />
    </div>
  );
});

function TokenSection({
  sectionTitle,
  sectionDesc,
  tokenValue,
  onTokenChange,
  onValidate,
  loading,
  validateState,
  error,
  tokenLabel,
  copyFieldId,
  copiedField,
  onCopy,
}: {
  sectionTitle: string;
  sectionDesc: string;
  tokenValue: string;
  onTokenChange: (v: string) => void;
  onValidate: (token: string) => void;
  loading: boolean;
  validateState: ValidateState;
  error: string | null;
  tokenLabel: string;
  copyFieldId: string;
  copiedField: string | null;
  onCopy: (text: string, id: string) => void;
}) {
  const { t } = useI18n();
  const decoded = useMemo(() => decodeJwt(tokenValue), [tokenValue]);
  const isValidStructure = tokenValue.trim().split('.').length === 3;
  const [headerTab, setHeaderTab] = useState<'json' | 'table'>('json');
  const [payloadTab, setPayloadTab] = useState<'json' | 'table'>('json');

  function formatExpirationTooltip(value: unknown): { dateStr: string; timeStr: string; tzName: string } | null {
    const ts = typeof value === 'number' ? value : typeof value === 'string' ? parseInt(value, 10) : NaN;
    if (Number.isNaN(ts)) return null;
    const date = new Date(ts * 1000);
    const dateStr = date.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZoneName: 'shortOffset' });
    const tzPart = new Intl.DateTimeFormat(undefined, { timeZoneName: 'long' }).formatToParts(date).find((p) => p.type === 'timeZoneName');
    const tzName = tzPart?.value ? `(${tzPart.value})` : '';
    return { dateStr, timeStr, tzName };
  }

  function ClaimsTable({ data, contentMinHeight }: { data: Record<string, unknown>; contentMinHeight?: string }) {
    const entries = Object.entries(data);
    return (
      <>
        {/* Presentation-only table (§14 Table, not DataTable): no selection, sort
            or filters — just the claims, with the header pinned while scrolling. */}
        <Table
          stickyHeader
          className={cn('overflow-y-auto rounded-lg', contentMinHeight || 'min-h-[120px] max-h-[200px]')}
          tableProps={{ className: 'text-caption' }}
        >
          <TableHeader>
            <TableRow>
              <TableHead>{t('tokens.claimKey')}</TableHead>
              <TableHead>{t('tokens.claimValue')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
              {entries.map(([key, value]) => {
                const displayValue = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);
                const expTooltip = key === 'exp' ? formatExpirationTooltip(value) : null;
                return (
                  <TableRow key={key}>
                    <TableCell className="font-mono text-text-muted">{key}</TableCell>
                    <TableCell className="font-mono break-all">
                      {expTooltip ? (
                        <Tooltip
                          side="top"
                          delay={300}
                          className="max-w-[320px] whitespace-normal text-left"
                          content={
                            <span className="flex flex-col gap-0.5">
                              <span>{expTooltip.dateStr}</span>
                              <span>{expTooltip.timeStr}</span>
                              {expTooltip.tzName && <span className="text-text-muted">{expTooltip.tzName}</span>}
                            </span>
                          }
                        >
                          <span className="cursor-help underline decoration-dotted decoration-bg-subtle underline-offset-2">
                            {displayValue}
                          </span>
                        </Tooltip>
                      ) : (
                        displayValue
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </>
    );
  }

  // The payload's `exp` claim gets a hover tooltip that formats the epoch
  // second as a human date — anything else falls through to JsonViewer's
  // default primitive rendering (§20 token colors, hover copy, etc.).
  function renderPayloadExp({ key, value }: { key: string | undefined; value: unknown }) {
    if (key !== 'exp' || typeof value !== 'number') return undefined;
    const expTooltip = formatExpirationTooltip(value);
    if (!expTooltip) return undefined;
    return (
      <Tooltip
        side="top"
        delay={300}
        className="max-w-[320px] whitespace-normal text-left"
        content={
          <span className="flex flex-col gap-0.5">
            <span>{expTooltip.dateStr}</span>
            <span>{expTooltip.timeStr}</span>
            {expTooltip.tzName && <span className="opacity-90">{expTooltip.tzName}</span>}
          </span>
        }
      >
        <span className="text-accent cursor-help underline decoration-dotted underline-offset-2">
          {value}
        </span>
      </Tooltip>
    );
  }

  function TabBar({ active, onSelect }: { active: 'json' | 'table'; onSelect: (v: 'json' | 'table') => void }) {
    return (
      <div className="flex gap-0 border-b border-border mb-2">
        <button
          type="button"
          onClick={() => onSelect('json')}
          className={cn(
            'px-3 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-px',
            active === 'json'
              ? 'text-text border-accent-border'
              : 'text-text-muted border-transparent hover:text-text'
          )}
        >
          JSON
        </button>
        <button
          type="button"
          onClick={() => onSelect('table')}
          className={cn(
            'px-3 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-px',
            active === 'table'
              ? 'text-text border-accent-border'
              : 'text-text-muted border-transparent hover:text-text'
          )}
        >
          {t('tokens.claimsTable')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Heading level={2} visual="h3" className="flex items-center gap-2">
          <Icon icon={ShieldCheck} size={16} />
          {sectionTitle}
        </Heading>
        <Text variant="body-sm" tone="secondary" as="p" className="mt-0.5">{sectionDesc}</Text>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:min-h-[480px]">
        {/* Left: Encoded value */}
        <div className="lg:col-span-5 flex flex-col min-h-[320px] lg:min-h-0">
          <Card className="flex flex-col flex-1 min-h-0">
            <CardHeader className="pb-2 shrink-0">
              <Text variant="overline" tone="secondary" as="div">
                {t('tokens.encodedValue')}
              </Text>
              <Text variant="caption" tone="secondary" as="p" className="mt-0.5">{t('tokens.jwtSubheading')}</Text>
            </CardHeader>
            <CardBody className="flex flex-col flex-1 min-h-0 gap-3">
              <JwtTextarea
                placeholder="eyJhbGciOiJSUzI1NiIs..."
                aria-label={tokenLabel}
                value={tokenValue}
                onChange={onTokenChange}
                className="w-full flex-1 min-h-[200px]"
              />
              <Inline gap={2} wrap className="shrink-0">
                <Tooltip content={t('tooltips.validateToken')}>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => onValidate(tokenValue.trim())}
                    disabled={!tokenValue.trim() || loading}
                    leading={loading ? <Spinner size={14} /> : undefined}
                  >
                    {loading ? t('tokens.validating') : t('tokens.validate')}
                  </Button>
                </Tooltip>
                <Tooltip content={t('tooltips.copyId')}>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => onCopy(tokenValue, copyFieldId)}
                    disabled={!tokenValue.trim()}
                    leading={<Icon icon={copiedField === copyFieldId ? Check : Copy} size={14} />}
                  >
                    {t('common.copy')}
                  </Button>
                </Tooltip>

                <Tooltip content={t('tooltips.clearInput')}>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onTokenChange('')}
                    disabled={!tokenValue.trim()}
                    leading={<Icon icon={Trash2} size={14} />}
                  >
                    {t('tokens.clear')}
                  </Button>
                </Tooltip>
              </Inline>
              <div className="shrink-0 space-y-1">
                {tokenValue.trim() && (
                  <p className={cn(
                    'text-caption',
                    isValidStructure ? 'text-success' : 'text-text-muted'
                  )}>
                    {isValidStructure ? t('tokens.validJwtStructure') : t('tokens.invalidJwtStructure')}
                  </p>
                )}
                {validateState && (
                  <p className={cn(
                    'text-caption font-medium',
                    validateState.result.is_valid ? 'text-success' : 'text-danger'
                  )}>
                    {validateState.result.is_valid
                      ? t('tokens.validResult', { type: validateState.result.entity_type || '—' })
                      : t('tokens.invalidResult')}
                  </p>
                )}
                {error && <p className="text-xs text-danger">{error}</p>}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Right: Decoded header + payload stacked (fixed heights to avoid layout shift) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <Card>
            <CardHeader
              className="pb-2"
              actions={
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={!decoded}
                  onClick={() => decoded && onCopy(JSON.stringify(decoded.header, null, 2), `${copyFieldId}-header`)}
                  leading={<Icon icon={copiedField === `${copyFieldId}-header` ? Check : Copy} size={12} />}
                >
                  {t('common.copy')}
                </Button>
              }
            >
              <Text variant="overline" tone="secondary" as="div">
                {t('tokens.decodedHeader')}
              </Text>
            </CardHeader>
            <CardBody>
              <TabBar active={headerTab} onSelect={setHeaderTab} />
              <div className="min-h-[120px]">
                {decoded ? (
                  headerTab === 'json' ? (
                    <JsonViewer
                      data={decoded.header}
                      defaultExpandDepth={2}
                      expandable
                      copyValue
                      copyPath
                      copy={false}
                      className="min-h-[120px]"
                    />
                  ) : (
                    <div className="rounded-lg border border-border bg-bg-subtle overflow-hidden">
                      <ClaimsTable data={decoded.header} contentMinHeight="min-h-[120px] max-h-[200px]" />
                    </div>
                  )
                ) : (
                  <p className="text-caption text-text-muted p-6 text-center min-h-[120px] flex items-center justify-center rounded-lg border border-border bg-bg-subtle">
                    {t('tokens.pasteTokenToDecode')}
                  </p>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              className="pb-2"
              actions={
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={!decoded}
                  onClick={() => decoded && onCopy(JSON.stringify(decoded.payload, null, 2), `${copyFieldId}-payload`)}
                  leading={<Icon icon={copiedField === `${copyFieldId}-payload` ? Check : Copy} size={12} />}
                >
                  {t('common.copy')}
                </Button>
              }
            >
              <Text variant="overline" tone="secondary" as="div">
                {t('tokens.decodedPayload')}
              </Text>
            </CardHeader>
            <CardBody>
              <TabBar active={payloadTab} onSelect={setPayloadTab} />
              <div className="min-h-[220px]">
                {decoded ? (
                  payloadTab === 'json' ? (
                    <JsonViewer
                      data={decoded.payload}
                      defaultExpandDepth={2}
                      expandable
                      copyValue
                      copyPath
                      copy={false}
                      renderValue={renderPayloadExp}
                      className="min-h-[220px]"
                    />
                  ) : (
                    <div className="rounded-lg border border-border bg-bg-subtle overflow-hidden">
                      <ClaimsTable data={decoded.payload} contentMinHeight="min-h-[220px] max-h-[280px]" />
                    </div>
                  )
                ) : (
                  <p className="text-caption text-text-muted p-6 text-center min-h-[220px] flex items-center justify-center rounded-lg border border-border bg-bg-subtle">
                    {t('tokens.pasteTokenToDecode')}
                  </p>
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function TokensPage() {
  const { apiUrl: getApiUrl, showNotification } = useAdmin();
  const { t } = useI18n();

  const [accessToken, setAccessToken] = useState('');
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessState, setAccessState] = useState<ValidateState>(null);
  const [accessError, setAccessError] = useState<string | null>(null);

  const [refreshToken, setRefreshToken] = useState('');
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [refreshState, setRefreshState] = useState<ValidateState>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const [getAccessOpen, setGetAccessOpen] = useState(false);
  const [dialogRefreshInput, setDialogRefreshInput] = useState('');
  const [dialogLoading, setDialogLoading] = useState(false);
  const [dialogResult, setDialogResult] = useState<{ jwt: string; refresh_token: string } | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'access' | 'refresh'>('access');
  const dialogRefreshTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = dialogRefreshTextareaRef.current;
    if (!el || !getAccessOpen) return;
    el.style.height = 'auto';
    const minH = 180;
    const maxH = Math.min(500, typeof window !== 'undefined' ? Math.round(window.innerHeight * 0.5) : 500);
    const h = Math.min(Math.max(el.scrollHeight, minH), maxH);
    el.style.height = `${h}px`;
  }, [dialogRefreshInput, getAccessOpen]);

  const handleValidateAccess = async (token: string) => {
    const tok = token.trim();
    if (!tok) {
      showNotification(t('tokens.tokenRequired'), 'error');
      return;
    }
    setAccessLoading(true);
    setAccessState(null);
    setAccessError(null);
    try {
      const res = await fetch(getApiUrl('/api/tokens/validate-access'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tok }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setAccessState({
          result: { is_valid: data.data.is_valid ?? false, entity_type: data.data.entity_type },
        });
      } else {
        setAccessError(data.error?.message || t('tokens.validateError'));
        setAccessState({ result: { is_valid: false } });
      }
    } catch {
      setAccessError(t('tokens.errorConnection'));
      setAccessState({ result: { is_valid: false } });
    } finally {
      setAccessLoading(false);
    }
  };

  const handleValidateRefresh = async (token: string) => {
    const tok = token.trim();
    if (!tok) {
      showNotification(t('tokens.refreshTokenRequired'), 'error');
      return;
    }
    setRefreshLoading(true);
    setRefreshState(null);
    setRefreshError(null);
    try {
      const res = await fetch(getApiUrl('/api/tokens/validate-refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tok }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setRefreshState({
          result: { is_valid: data.data.is_valid ?? false, entity_type: data.data.entity_type },
        });
      } else {
        setRefreshError(data.error?.message || t('tokens.validateError'));
        setRefreshState({ result: { is_valid: false } });
      }
    } catch {
      setRefreshError(t('tokens.errorConnection'));
      setRefreshState({ result: { is_valid: false } });
    } finally {
      setRefreshLoading(false);
    }
  };

  const handleGetAccessInDialog = async () => {
    const tok = dialogRefreshInput.trim();
    if (!tok) {
      showNotification(t('tokens.refreshTokenRequired'), 'error');
      return;
    }
    setDialogLoading(true);
    setDialogResult(null);
    setDialogError(null);
    try {
      const res = await fetch(getApiUrl('/api/tokens/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: tok }),
      });
      const data = await res.json();
      const accessToken = data.data?.access_token ?? data.data?.jwt;
      if (data.success && data.data && accessToken) {
        setDialogResult({
          jwt: accessToken,
          refresh_token: data.data.refresh_token ?? tok,
        });
      } else {
        setDialogError(data.error?.message || t('tokens.refreshError'));
      }
    } catch {
      setDialogError(t('tokens.errorConnection'));
    } finally {
      setDialogLoading(false);
    }
  };

  const openGetAccessDialog = () => {
    setGetAccessOpen(true);
    setDialogRefreshInput('');
    setDialogResult(null);
    setDialogError(null);
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    showNotification(t('common.copied'), 'success');
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-10"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Heading level={1} className="flex items-center gap-2">
            <Key className="w-8 h-8 text-accent" />
            {t('tokens.title')}
          </Heading>
          <Text tone="secondary" as="p" className="mt-1">{t('tokens.subtitle')}</Text>
        </div>
        <Tooltip content={t('tooltips.getToken')}>
          <Button
            variant="primary"
            onClick={openGetAccessDialog}
            className="shrink-0"
            leading={<Icon icon={RefreshCw} size={14} />}
          >
            {t('tokens.getAccessToken')}
          </Button>
        </Tooltip>
      </div>

      <div className="space-y-4">
        <Inline gap={1} className="p-1 rounded-lg bg-subtle/50 w-fit">
          <Button
            type="button"
            variant={activeTab === 'access' ? 'secondary' : 'ghost'}
            onClick={() => setActiveTab('access')}
            leading={<Icon icon={ShieldCheck} size={14} />}
          >
            {t('tokens.tabAccess')}
          </Button>
          <Button
            type="button"
            variant={activeTab === 'refresh' ? 'secondary' : 'ghost'}
            onClick={() => setActiveTab('refresh')}
            leading={<Icon icon={RefreshCw} size={14} />}
          >
            {t('tokens.tabRefresh')}
          </Button>
        </Inline>

        {activeTab === 'access' && (
          <TokenSection
            key="access"
            sectionTitle={t('tokens.validateAccessTitle')}
            sectionDesc={t('tokens.validateAccessDesc')}
            tokenValue={accessToken}
            onTokenChange={setAccessToken}
            onValidate={handleValidateAccess}
            loading={accessLoading}
            validateState={accessState}
            error={accessError}
            tokenLabel={t('tokens.accessTokenLabel')}
            copyFieldId="access-encoded"
            copiedField={copiedField}
            onCopy={copyToClipboard}
          />
        )}
        {activeTab === 'refresh' && (
          <TokenSection
            key="refresh"
            sectionTitle={t('tokens.validateRefreshTitle')}
            sectionDesc={t('tokens.validateRefreshDesc')}
            tokenValue={refreshToken}
            onTokenChange={setRefreshToken}
            onValidate={handleValidateRefresh}
            loading={refreshLoading}
            validateState={refreshState}
            error={refreshError}
            tokenLabel={t('tokens.refreshTokenLabel')}
            copyFieldId="refresh-encoded"
            copiedField={copiedField}
            onCopy={copyToClipboard}
          />
        )}
      </div>

      <Dialog open={getAccessOpen} onOpenChange={setGetAccessOpen}>
        <DialogContent
          className="sm:max-w-2xl"
          style={{ minHeight: 'min(560px, 85vh)' }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon icon={RefreshCw} size={16} />
              {t('tokens.getAccessToken')}
            </DialogTitle>
            <DialogDescription>{t('tokens.getAccessTokenDialogDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <FormField label={t('tokens.refreshTokenInput')}>
              <div className="flex gap-2">
                <JwtTextarea
                  ref={dialogRefreshTextareaRef}
                  value={dialogRefreshInput}
                  onChange={setDialogRefreshInput}
                  placeholder={t('tokens.refreshTokenInput')}
                  wrapperClassName="flex-1 min-w-0 min-h-[180px] max-h-[50vh]"
                  className="min-h-[180px]"
                />
                <IconButton
                  icon={copiedField === 'dialog-refresh' ? Check : Copy}
                  label={t('common.copy')}
                  variant="secondary"
                  className="shrink-0"
                  onClick={() => copyToClipboard(dialogRefreshInput, 'dialog-refresh')}
                  disabled={!dialogRefreshInput.trim()}
                />
              </div>
            </FormField>
            {dialogError && (
              <p className="text-sm text-danger rounded-md bg-danger-bg/10 px-3 py-2">{dialogError}</p>
            )}
            {dialogResult && (
              <div className="space-y-3 rounded-lg border border-success-border bg-success-bg p-4">
                <div className="flex items-center gap-2 text-success text-body-sm font-medium">
                  <Check className="w-4 h-4 shrink-0" />
                  {t('tokens.newAccessToken')}
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 min-w-0 min-h-[140px] max-h-[220px] overflow-auto rounded-md border bg-subtle/30 px-3 py-2">
                    <JwtColoredView value={dialogResult.jwt} className="block" />
                  </div>
                  <IconButton
                    icon={copiedField === 'dialog-jwt' ? Check : Copy}
                    label={t('common.copy')}
                    variant="secondary"
                    className="shrink-0"
                    onClick={() => copyToClipboard(dialogResult.jwt, 'dialog-jwt')}
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setGetAccessOpen(false)}>
              {t('common.close')}
            </Button>
            <Button variant="primary" onClick={handleGetAccessInDialog} disabled={dialogLoading} leading={dialogLoading ? <Spinner size={14} /> : undefined}>
              {dialogLoading ? t('tokens.refreshing') : t('tokens.getAccessToken')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
