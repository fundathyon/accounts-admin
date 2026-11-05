'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Monitor, RotateCcw, Smartphone } from 'lucide-react';
import { Alert, Card, FormField, Heading, Icon, Input, Select, Skeleton, Text, Textarea, Tooltip } from '@foundathyon/community-ui';
import { Badge } from '@/components/fdn/badge';
import { Button } from '@/components/fdn/button';
import { SaveFooter } from '@/components/security-screen/save-footer';
import { ScreenLoadError } from '@/components/security-screen/screen-states';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes-warning';
import { apiError } from '@/lib/api-envelope';
import {
  DEFAULT_PREVIEW_TEMPLATE,
  EMAIL_LOCALE,
  brandingErrors,
  compactBranding,
  emailTemplatesErrorMessage,
  normalizeHex,
  previewOverride,
  readEnvelope,
  sameLook,
  type CatalogItem,
  type Corners,
  type EmailBranding,
  type EmailLook,
  type EmailPreview,
  type EmailRequest,
  type EmailThemesData,
  type Font,
} from '@/lib/email-templates';
import { BrandingGroup, CustomColor, LogoPreview, Segmented, Swatch, onRadioGroupKeyDown } from './branding-controls';
import { EmailPreviewFrame, type PreviewDevice } from './email-preview-frame';
import { ThemeThumbnail } from './theme-thumbnail';

const PREVIEW_DEBOUNCE_MS = 300;

/** Brand colours offered next to the theme's own accent. */
const ACCENT_PRESETS = ['#2563eb', '#7c3aed', '#db2777', '#e11d48', '#ea580c', '#ca8a04', '#16a34a', '#0d9488', '#0f172a'];

const CORNER_OPTIONS: ('' | Corners)[] = ['', 'sharp', 'soft', 'round'];
const FONT_OPTIONS: ('' | Font)[] = ['', 'sans', 'serif', 'mono'];

/**
 * The look of every email Accounts sends for this scope: a theme plus the
 * branding layered on top, edited side by side with a live preview of the real
 * email. Nothing is stored until Save; the preview renders the draft server
 * side, so what you see is exactly what gets sent.
 */
export function BrandingEditor({
  request,
  secretKey,
  catalog,
  sender,
  revision,
  onSaved,
}: {
  request: EmailRequest;
  /** `null` for the global scope. */
  secretKey: string | null;
  catalog: CatalogItem[];
  sender?: string;
  /** Changes when something else altered what the preview renders. */
  revision: number;
  onSaved: () => void;
}) {
  const { showNotification } = useAdmin();
  const { t } = useI18n();

  const [data, setData] = useState<EmailThemesData | null>(null);
  const [loadError, setLoadError] = useState('');
  const [saved, setSaved] = useState<EmailLook | null>(null);
  const [draft, setDraft] = useState<EmailLook | null>(null);
  const [saving, setSaving] = useState(false);

  const [previewId, setPreviewId] = useState(DEFAULT_PREVIEW_TEMPLATE);
  const [device, setDevice] = useState<PreviewDevice>('desktop');
  const [preview, setPreview] = useState<EmailPreview | null>(null);
  const [previewError, setPreviewError] = useState('');
  // The draft the shown preview belongs to: loading is "not that one yet".
  const [renderedKey, setRenderedKey] = useState('');
  const previewSeq = useRef(0);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const res = await request('/themes');
      const json = await readEnvelope(res);
      if (!res.ok || !json?.data) {
        setLoadError(emailTemplatesErrorMessage(t, apiError(json), t('emailTemplates.branding.loadFailed')));
        return;
      }
      const themes = json.data as EmailThemesData;
      const look = { themeId: themes.active_theme_id, branding: themes.branding ?? {} };
      setData(themes);
      setSaved(look);
      setDraft(look);
    } catch {
      setLoadError(t('securityScreens.networkError'));
    }
  }, [request, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const errors = draft ? brandingErrors(draft.branding) : {};
  const hasErrors = Object.keys(errors).length > 0;
  const dirty = !!draft && !!saved && !sameLook(draft, saved);
  useUnsavedChangesWarning(dirty);

  const previewBody = draft
    ? JSON.stringify({
        locale: EMAIL_LOCALE,
        sample_variables: {},
        theme_id: draft.themeId,
        branding: compactBranding(draft.branding),
      })
    : '';
  const previewKey = `${previewId}|${revision}|${previewBody}`;

  // Live preview of the draft. Invalid drafts keep the last good render.
  useEffect(() => {
    if (!previewBody || hasErrors) return;
    const seq = ++previewSeq.current;
    const timer = setTimeout(async () => {
      let error = '';
      try {
        const res = await request(`/${encodeURIComponent(previewId)}/preview`, { method: 'POST', body: previewBody });
        const json = await readEnvelope(res);
        if (seq !== previewSeq.current) return;
        if (res.ok && json?.data) setPreview(json.data as EmailPreview);
        else error = emailTemplatesErrorMessage(t, apiError(json), t('emailTemplates.branding.previewFailed'));
      } catch {
        if (seq !== previewSeq.current) return;
        error = t('securityScreens.networkError');
      }
      setPreviewError(error);
      setRenderedKey(`${previewId}|${revision}|${previewBody}`);
    }, PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [hasErrors, previewBody, previewId, request, revision, t]);

  const setBranding = (patch: EmailBranding) => setDraft((d) => (d ? { ...d, branding: { ...d.branding, ...patch } } : d));

  const save = async () => {
    if (!draft || hasErrors || saving) return;
    setSaving(true);
    try {
      const res = await request('/themes/active', {
        method: 'PUT',
        body: JSON.stringify({ theme_id: draft.themeId, branding: compactBranding(draft.branding) }),
      });
      const json = await readEnvelope(res);
      if (!res.ok || !json?.data) {
        showNotification(emailTemplatesErrorMessage(t, apiError(json), t('emailTemplates.branding.saveFailed')), 'error');
        return;
      }
      const active = json.data as { theme_id: string; branding?: EmailBranding };
      const look = { themeId: active.theme_id, branding: active.branding ?? {} };
      setSaved(look);
      setDraft(look);
      setData((d) => (d ? { ...d, active_theme_id: look.themeId, branding: look.branding } : d));
      showNotification(t('emailTemplates.branding.saved'), 'success');
      onSaved();
    } catch {
      showNotification(t('securityScreens.networkError'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loadError) return <ScreenLoadError message={loadError} onRetry={load} />;

  if (!data || !draft || !saved) {
    return (
      <div className="grid gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
        <Skeleton variant="rect" className="h-[640px] w-full" />
        <Skeleton variant="rect" className="h-[640px] w-full" />
      </div>
    );
  }

  const themes = data.themes;
  const draftTheme = themes.find((th) => th.id === draft.themeId);
  const branding = draft.branding;
  const themeAccent = draftTheme?.tokens.accent ?? '#000000';
  const accent = branding.accent_color ? normalizeHex(branding.accent_color) : '';
  const accentIsPreset = !accent || ACCENT_PRESETS.includes(accent);
  const override = previewOverride(preview?.source, secretKey);
  const fieldError = (key: keyof EmailBranding) =>
    errors[key] ? t(`emailTemplates.branding.errors.${errors[key]}`) : undefined;

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
      <div className="min-w-0 space-y-4">
        <Card>
          <div className="flex items-start justify-between gap-3 px-4 py-3">
            <div>
              <Heading level={2} visual="h5">{t('emailTemplates.branding.customize.title')}</Heading>
              <Text variant="body-sm" tone="muted" as="p" className="mt-0.5">
                {t('emailTemplates.branding.customize.description')}
              </Text>
            </div>
            {Object.keys(compactBranding(branding)).length > 0 && (
              <Tooltip content={t('emailTemplates.branding.resetBrandHint')}>
                <Button
                  variant="ghost"
                  size="xs"
                  className="shrink-0"
                  leading={<Icon icon={RotateCcw} size={12} />}
                  onClick={() => setDraft((d) => (d ? { ...d, branding: {} } : d))}
                >
                  {t('emailTemplates.branding.resetBrand')}
                </Button>
              </Tooltip>
            )}
          </div>

          <BrandingGroup title={t('emailTemplates.branding.theme.title')} description={t('emailTemplates.branding.theme.description')}>
            <div
              role="radiogroup"
              aria-label={t('emailTemplates.branding.theme.title')}
              className="grid grid-cols-3 gap-1"
              onKeyDown={onRadioGroupKeyDown}
            >
              {themes.map((th, i) => (
                <ThemeThumbnail
                  key={th.id}
                  theme={th}
                  branding={branding}
                  selected={th.id === draft.themeId}
                  active={th.id === saved.themeId}
                  tabbable={draftTheme ? th.id === draftTheme.id : i === 0}
                  onSelect={() => setDraft((d) => (d ? { ...d, themeId: th.id } : d))}
                />
              ))}
            </div>
            {draftTheme && <Text variant="body-sm" tone="muted" as="p">{draftTheme.description}</Text>}
          </BrandingGroup>

          <BrandingGroup title={t('emailTemplates.branding.logoName.title')} description={t('emailTemplates.branding.logoName.description')}>
            <FormField
              label={t('emailTemplates.branding.logo.label')}
              description={t('emailTemplates.branding.logo.hint')}
              error={fieldError('logo_url')}
            >
              <div className="flex items-center gap-2">
                <Input
                  type="url"
                  inputMode="url"
                  placeholder="https://cdn.example.com/logo.png"
                  value={branding.logo_url ?? ''}
                  onChange={(e) => setBranding({ logo_url: e.target.value })}
                  wrapperClassName="min-w-0 flex-1"
                />
                <LogoPreview url={errors.logo_url ? '' : (branding.logo_url?.trim() ?? '')} />
              </div>
            </FormField>
            <FormField
              label={t('emailTemplates.branding.displayName.label')}
              description={t(branding.logo_url ? 'emailTemplates.branding.displayName.hintWithLogo' : 'emailTemplates.branding.displayName.hintNoLogo')}
              error={fieldError('display_name')}
            >
              <Input
                placeholder={t('emailTemplates.branding.displayName.placeholder')}
                maxLength={80}
                value={branding.display_name ?? ''}
                onChange={(e) => setBranding({ display_name: e.target.value })}
              />
            </FormField>
          </BrandingGroup>

          <BrandingGroup title={t('emailTemplates.branding.accent.title')} description={t('emailTemplates.branding.accent.description')}>
            <div
              role="radiogroup"
              aria-label={t('emailTemplates.branding.accent.title')}
              className="flex flex-wrap items-center gap-1.5"
              onKeyDown={onRadioGroupKeyDown}
            >
              <Swatch
                color={themeAccent}
                label={t('emailTemplates.branding.accent.themeAccent')}
                selected={!accent}
                tabbable={!accent || !accentIsPreset}
                onSelect={() => setBranding({ accent_color: '' })}
                badge="T"
              />
              <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />
              {ACCENT_PRESETS.map((c) => (
                <Swatch
                  key={c}
                  color={c}
                  label={c}
                  selected={accent === c}
                  tabbable={accent === c}
                  onSelect={() => setBranding({ accent_color: c })}
                />
              ))}
              <CustomColor
                value={accentIsPreset ? '' : accent}
                fallback={accent || themeAccent}
                onChange={(c) => setBranding({ accent_color: c })}
              />
            </div>
            <FormField label={t('emailTemplates.branding.accent.hex')} error={fieldError('accent_color')}>
              <Input
                className="font-mono"
                wrapperClassName="w-32"
                placeholder={themeAccent}
                value={branding.accent_color ?? ''}
                onChange={(e) => setBranding({ accent_color: e.target.value })}
              />
            </FormField>
          </BrandingGroup>

          <BrandingGroup title={t('emailTemplates.branding.shape.title')}>
            <div className="flex items-center justify-between gap-3">
              <Text variant="label" tone="secondary">{t('emailTemplates.branding.shape.corners')}</Text>
              <Segmented
                label={t('emailTemplates.branding.shape.corners')}
                options={CORNER_OPTIONS.map((value) => ({
                  value,
                  label: t(`emailTemplates.branding.shape.options.${value || 'theme'}`),
                }))}
                value={branding.corners ?? ''}
                onChange={(v) => setBranding({ corners: v || undefined })}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Text variant="label" tone="secondary">{t('emailTemplates.branding.shape.font')}</Text>
              <Segmented
                label={t('emailTemplates.branding.shape.font')}
                options={FONT_OPTIONS.map((value) => ({
                  value,
                  label: t(`emailTemplates.branding.shape.options.${value || 'theme'}`),
                }))}
                value={branding.font ?? ''}
                onChange={(v) => setBranding({ font: v || undefined })}
              />
            </div>
          </BrandingGroup>

          <BrandingGroup title={t('emailTemplates.branding.footer.title')} description={t('emailTemplates.branding.footer.description')}>
            <FormField
              label={t('emailTemplates.branding.footer.label')}
              description={t('emailTemplates.branding.footer.hint')}
              error={fieldError('footer_text')}
            >
              <Textarea
                rows={3}
                maxLength={300}
                placeholder="Acme Inc. · 548 Market St, San Francisco"
                value={branding.footer_text ?? ''}
                onChange={(e) => setBranding({ footer_text: e.target.value })}
              />
            </FormField>
            <FormField
              label={t('emailTemplates.branding.support.label')}
              description={t('emailTemplates.branding.support.hint')}
              error={fieldError('support_email')}
            >
              <Input
                type="email"
                placeholder="support@example.com"
                value={branding.support_email ?? ''}
                onChange={(e) => setBranding({ support_email: e.target.value })}
              />
            </FormField>
          </BrandingGroup>
        </Card>

        <SaveFooter
          dirty={dirty}
          saving={saving}
          canSave={!hasErrors}
          onDiscard={() => setDraft(saved)}
          onSave={save}
        />
      </div>

      {/* The content column (main) is the scroll container: pinned to its top
          and capped to its height (the 3.5rem header plus 1rem on each side),
          so the preview stays in view next to any control and a long email
          scrolls inside the frame. */}
      <div className="flex min-w-0 flex-col gap-3 xl:sticky xl:top-4 xl:max-h-[calc(100svh-5.5rem)]">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label={t('emailTemplates.branding.previewEmail')}
            className="w-[260px] max-w-full"
            items={catalog.map((c) => ({ value: c.id, label: c.name }))}
            value={previewId}
            onValueChange={(v) => v && setPreviewId(v)}
          />
          <Segmented
            label={t('emailTemplates.branding.previewWidth')}
            options={[
              { value: 'desktop', label: t('emailTemplates.branding.desktop'), icon: <Icon icon={Monitor} size={14} /> },
              { value: 'mobile', label: t('emailTemplates.branding.mobile'), icon: <Icon icon={Smartphone} size={14} /> },
            ]}
            value={device}
            onChange={setDevice}
          />
          {dirty && <Badge tone="info" className="ml-auto">{t('emailTemplates.branding.draftPreview')}</Badge>}
        </div>
        {override && (
          <Alert
            tone="info"
            title={t(override === 'own' ? 'emailTemplates.branding.customHtmlNotice' : 'emailTemplates.branding.inheritedHtmlNotice')}
          />
        )}
        {previewError && <Alert tone="danger" title={previewError} />}
        <EmailPreviewFrame
          html={preview?.html ?? null}
          subject={preview?.subject ?? ''}
          fromName={preview?.from_name}
          sender={sender}
          device={device}
          loading={!hasErrors && renderedKey !== previewKey}
          className="min-h-0 flex-1"
        />
      </div>
    </div>
  );
}
