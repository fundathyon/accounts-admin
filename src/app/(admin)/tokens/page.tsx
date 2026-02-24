'use client';

import { useState, useMemo, useRef, useEffect, forwardRef } from 'react';
import type { ComponentProps, UIEvent, ReactNode } from 'react';
import {
  Key,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const JSON_KEY_CLASS = 'text-blue-600 dark:text-blue-400';
const JSON_STRING_CLASS = 'text-amber-700 dark:text-amber-300';
const JSON_NUMBER_CLASS = 'text-emerald-600 dark:text-emerald-400';
const JSON_BOOLEAN_CLASS = 'text-purple-600 dark:text-purple-400';
const JSON_NULL_CLASS = 'text-muted-foreground';

function JsonSyntaxHighlight({
  data,
  indent = 0,
  renderCustomValue,
}: {
  data: unknown;
  indent?: number;
  renderCustomValue?: (key: string, value: unknown) => React.ReactNode | null;
}): ReactNode {
  const pad = '  '.repeat(indent);
  const padInner = '  '.repeat(indent + 1);

  if (data === null) {
    return <span className={JSON_NULL_CLASS}>null</span>;
  }
  if (typeof data === 'boolean') {
    return <span className={JSON_BOOLEAN_CLASS}>{data ? 'true' : 'false'}</span>;
  }
  if (typeof data === 'number') {
    return <span className={JSON_NUMBER_CLASS}>{data}</span>;
  }
  if (typeof data === 'string') {
    return <span className={JSON_STRING_CLASS}>{JSON.stringify(data)}</span>;
  }
  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="text-foreground">[]</span>;
    return (
      <>
        <span className="text-foreground">[</span>
        <span className="text-foreground">{'\n'}</span>
        {data.map((item, i) => (
          <span key={i}>
            <span className="text-foreground">{padInner}</span>
            {JsonSyntaxHighlight({ data: item, indent: indent + 1, renderCustomValue })}
            {i < data.length - 1 ? <span className="text-foreground">,</span> : null}
            <span className="text-foreground">{'\n'}</span>
          </span>
        ))}
        <span className="text-foreground">{pad}</span>
        <span className="text-foreground">]</span>
      </>
    );
  }
  if (typeof data === 'object' && data !== null) {
    const entries = Object.entries(data);
    if (entries.length === 0) return <span className="text-foreground">{'{}'}</span>;
    return (
      <>
        <span className="text-foreground">{'{\n'}</span>
        {entries.map(([key, value], i) => {
          const custom = renderCustomValue?.(key, value);
          const valueNode =
            custom !== undefined && custom !== null ? (
              custom
            ) : (
              JsonSyntaxHighlight({ data: value, indent: indent + 1, renderCustomValue })
            );
          return (
            <span key={key}>
              <span className="text-foreground">{padInner}</span>
              <span className={JSON_KEY_CLASS}>{JSON.stringify(key)}</span>
              <span className="text-foreground">{': '}</span>
              {valueNode}
              {i < entries.length - 1 ? <span className="text-foreground">,</span> : null}
              <span className="text-foreground">{'\n'}</span>
            </span>
          );
        })}
        <span className="text-foreground">{pad}</span>
        <span className="text-foreground">{'}'}</span>
      </>
    );
  }
  return null;
}

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
        'font-mono text-xs whitespace-pre-wrap break-all',
        asOverlay && 'pointer-events-none select-none',
        className
      )}
    >
      <span className="text-emerald-600 dark:text-emerald-400">{header}</span>
      <span className="text-foreground">.</span>
      <span className="text-amber-600 dark:text-amber-400">{payload}</span>
      <span className="text-foreground">.</span>
      <span className="text-blue-600 dark:text-blue-400">{signature}</span>
    </span>
  );
}

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
    <div className={cn('relative flex-1 min-h-[200px] flex flex-col', wrapperClassName)}>
      <div
        ref={overlayRef}
        className="absolute inset-0 overflow-auto rounded-md border border-input bg-background px-3 py-2 text-xs font-mono leading-normal"
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
          'relative z-10 w-full flex-1 min-h-[200px] rounded-md border border-transparent bg-transparent px-3 py-2 text-xs font-mono resize-none caret-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring',
          className
        )}
        spellCheck={false}
        {...props}
        style={{ ...(props as { style?: React.CSSProperties }).style, color: 'transparent' }}
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

  function formatExpiration(value: unknown): string | null {
    const ts = typeof value === 'number' ? value : typeof value === 'string' ? parseInt(value, 10) : NaN;
    if (Number.isNaN(ts)) return null;
    const date = new Date(ts * 1000);
    return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' });
  }

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
      <TooltipProvider delayDuration={300}>
        <div className={cn('overflow-x-auto overflow-y-auto rounded-lg border bg-muted/50', contentMinHeight || 'min-h-[120px] max-h-[200px]')}>
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted border-b">
              <tr>
                <th className="text-left font-medium px-3 py-2">{t('tokens.claimKey')}</th>
                <th className="text-left font-medium px-3 py-2">{t('tokens.claimValue')}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([key, value]) => {
                const displayValue = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);
                const expTooltip = key === 'exp' ? formatExpirationTooltip(value) : null;
                return (
                  <tr key={key} className="border-b border-border/50">
                    <td className="px-3 py-2 font-mono text-muted-foreground">{key}</td>
                    <td className="px-3 py-2 font-mono break-all">
                      {expTooltip ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help underline decoration-dotted decoration-muted-foreground underline-offset-2">
                              {displayValue}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[320px] text-left">
                            <div className="flex flex-col gap-0.5">
                              <span>{expTooltip.dateStr}</span>
                              <span>{expTooltip.timeStr}</span>
                              {expTooltip.tzName && <span className="text-muted-foreground">{expTooltip.tzName}</span>}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        displayValue
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </TooltipProvider>
    );
  }

  function PayloadJsonWithExpTooltip({ data }: { data: Record<string, unknown> }) {
    return (
      <pre className="p-3 h-full min-h-[220px] max-h-[280px] text-xs font-mono overflow-x-auto overflow-y-auto whitespace-pre-wrap break-all">
        {JsonSyntaxHighlight({
          data,
          renderCustomValue: (key, value) => {
            if (key !== 'exp' || typeof value !== 'number') return null;
            const expTooltip = formatExpirationTooltip(value);
            if (!expTooltip) return null;
            return (
              <Tooltip key={key}>
                <TooltipTrigger asChild>
                  <span className={cn(JSON_NUMBER_CLASS, 'cursor-help underline decoration-dotted decoration-muted-foreground underline-offset-2')}>
                    {value}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[320px] text-left">
                  <div className="flex flex-col gap-0.5">
                    <span>{expTooltip.dateStr}</span>
                    <span>{expTooltip.timeStr}</span>
                    {expTooltip.tzName && <span className="opacity-90">{expTooltip.tzName}</span>}
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          },
        })}
      </pre>
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
              ? 'text-foreground border-primary'
              : 'text-muted-foreground border-transparent hover:text-foreground'
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
              ? 'text-foreground border-primary'
              : 'text-muted-foreground border-transparent hover:text-foreground'
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
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <ShieldCheck className="w-5 h-5" />
          {sectionTitle}
        </h2>
        <p className="text-muted-foreground text-sm mt-0.5">{sectionDesc}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:min-h-[480px]">
        {/* Left: Encoded value */}
        <div className="lg:col-span-5 flex flex-col min-h-[320px] lg:min-h-0">
          <Card className="flex flex-col flex-1 min-h-0">
            <CardHeader className="pb-2 shrink-0">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {t('tokens.encodedValue')}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{t('tokens.jwtSubheading')}</p>
            </CardHeader>
            <CardContent className="flex flex-col flex-1 min-h-0 gap-3">
              <Label className="text-xs sr-only">{tokenLabel}</Label>
              <JwtTextarea
                placeholder="eyJhbGciOiJSUzI1NiIs..."
                value={tokenValue}
                onChange={onTokenChange}
                className="w-full flex-1 min-h-[200px]"
              />
              <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                type="button"
                size="sm"
                onClick={() => onValidate(tokenValue.trim())}
                disabled={loading || !tokenValue.trim()}
                className="gap-1.5"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {loading ? t('tokens.validating') : t('tokens.validate')}
              </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onCopy(tokenValue, copyFieldId)}
                  disabled={!tokenValue.trim()}
                >
                  {copiedField === copyFieldId ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {t('common.copy')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onTokenChange('')}
                  disabled={!tokenValue.trim()}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t('tokens.clear')}
                </Button>
              </div>
              <div className="shrink-0 space-y-1">
                {tokenValue.trim() && (
                  <p className={cn(
                    'text-xs',
                    isValidStructure ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                  )}>
                    {isValidStructure ? t('tokens.validJwtStructure') : t('tokens.invalidJwtStructure')}
                  </p>
                )}
                {validateState && (
                  <p className={cn(
                    'text-xs font-medium',
                    validateState.result.is_valid ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
                  )}>
                    {validateState.result.is_valid
                      ? t('tokens.validResult', { type: validateState.result.entity_type || '—' })
                      : t('tokens.invalidResult')}
                  </p>
                )}
                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Decoded header + payload stacked (fixed heights to avoid layout shift) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {t('tokens.decodedHeader')}
              </CardTitle>
              <CardAction>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={!decoded}
                  onClick={() => decoded && onCopy(JSON.stringify(decoded.header, null, 2), `${copyFieldId}-header`)}
                >
                  {copiedField === `${copyFieldId}-header` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {t('common.copy')}
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <TabBar active={headerTab} onSelect={setHeaderTab} />
              <div className="min-h-[120px] rounded-lg border bg-muted/50 overflow-hidden">
                {decoded ? (
                  headerTab === 'json' ? (
                    <pre className="p-3 h-full min-h-[120px] text-xs font-mono overflow-x-auto overflow-y-auto whitespace-pre-wrap break-all">
                      {JsonSyntaxHighlight({ data: decoded.header })}
                    </pre>
                  ) : (
                    <ClaimsTable data={decoded.header} contentMinHeight="min-h-[120px] max-h-[200px]" />
                  )
                ) : (
                  <p className="text-xs text-muted-foreground p-6 text-center min-h-[120px] flex items-center justify-center">
                    {t('tokens.pasteTokenToDecode')}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {t('tokens.decodedPayload')}
              </CardTitle>
              <CardAction>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={!decoded}
                  onClick={() => decoded && onCopy(JSON.stringify(decoded.payload, null, 2), `${copyFieldId}-payload`)}
                >
                  {copiedField === `${copyFieldId}-payload` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {t('common.copy')}
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <TabBar active={payloadTab} onSelect={setPayloadTab} />
              <div className="min-h-[220px] rounded-lg border bg-muted/50 overflow-hidden">
                {decoded ? (
                  payloadTab === 'json' ? (
                    <TooltipProvider delayDuration={300}>
                      <PayloadJsonWithExpTooltip data={decoded.payload} />
                    </TooltipProvider>
                  ) : (
                    <ClaimsTable data={decoded.payload} contentMinHeight="min-h-[220px] max-h-[280px]" />
                  )
                ) : (
                  <p className="text-xs text-muted-foreground p-6 text-center min-h-[220px] flex items-center justify-center">
                    {t('tokens.pasteTokenToDecode')}
                  </p>
                )}
              </div>
            </CardContent>
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
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Key className="w-8 h-8 text-primary" />
            {t('tokens.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('tokens.subtitle')}</p>
        </div>
        <Button onClick={openGetAccessDialog} className="gap-2 shrink-0">
          <RefreshCw className="w-4 h-4" />
          {t('tokens.getAccessToken')}
        </Button>
      </div>

      <div className="space-y-4">
        <div className="flex gap-1 p-1 rounded-lg bg-muted/50 w-fit">
          <Button
            type="button"
            variant={activeTab === 'access' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('access')}
            className="gap-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            {t('tokens.tabAccess')}
          </Button>
          <Button
            type="button"
            variant={activeTab === 'refresh' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('refresh')}
            className="gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {t('tokens.tabRefresh')}
          </Button>
        </div>

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
              <RefreshCw className="w-5 h-5" />
              {t('tokens.getAccessToken')}
            </DialogTitle>
            <DialogDescription>{t('tokens.getAccessTokenDialogDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>{t('tokens.refreshTokenInput')}</Label>
              <div className="flex gap-2">
                <JwtTextarea
                  ref={dialogRefreshTextareaRef}
                  value={dialogRefreshInput}
                  onChange={setDialogRefreshInput}
                  placeholder={t('tokens.refreshTokenInput')}
                  wrapperClassName="flex-1 min-w-0 min-h-[180px] max-h-[50vh]"
                  className="min-h-[180px]"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0 h-9"
                  onClick={() => copyToClipboard(dialogRefreshInput, 'dialog-refresh')}
                  disabled={!dialogRefreshInput.trim()}
                  title={t('common.copy')}
                >
                  {copiedField === 'dialog-refresh' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            {dialogError && (
              <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">{dialogError}</p>
            )}
            {dialogResult && (
              <div className="space-y-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                  <Check className="w-4 h-4 shrink-0" />
                  {t('tokens.newAccessToken')}
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 min-w-0 min-h-[140px] max-h-[220px] overflow-auto rounded-md border bg-muted/30 px-3 py-2">
                    <JwtColoredView value={dialogResult.jwt} className="block" />
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0 h-9"
                    onClick={() => copyToClipboard(dialogResult.jwt, 'dialog-jwt')}
                    title={t('common.copy')}
                  >
                    {copiedField === 'dialog-jwt' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGetAccessOpen(false)}>
              {t('common.close')}
            </Button>
            <Button onClick={handleGetAccessInDialog} disabled={dialogLoading} className="gap-2">
              {dialogLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {dialogLoading ? t('tokens.refreshing') : t('tokens.getAccessToken')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
