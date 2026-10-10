'use client';

import { useRef, type KeyboardEvent } from 'react';
import { Check, Image as ImageIcon } from 'lucide-react';
import { FormField, Input, Select, Slider, Switch, Text } from '@foundathyon/community-ui';
import { useI18n } from '@/context/i18n-context';
import { cn } from '@/lib/utils';
import { ACCENT_RANGE, DEFAULT_ACCENT, EMBEDDED_AUTH_LIMITS, accentCss, checkLogoUrl, sameAccent } from '@/lib/embedded-auth';
import type {
  EmbeddedAuthAccent,
  EmbeddedAuthBranding,
  EmbeddedAuthLayout,
  EmbeddedAuthLocale,
  EmbeddedAuthTheme,
} from '@/lib/admin-types';

/**
 * Accent presets: neutral, the default orange and the calibrated hues of the
 * Foundathyon product family (community-ui `tokens.css`). Anything else is
 * "custom" and edited with the three OKLCH sliders.
 */
const ACCENT_PRESETS: { id: string; labelKey: string; accent: EmbeddedAuthAccent }[] = [
  { id: 'neutral', labelKey: 'embeddedAuth.branding.accentNeutral', accent: 'neutral' },
  { id: 'orange', labelKey: 'embeddedAuth.branding.accentOrange', accent: { ...DEFAULT_ACCENT } },
  { id: 'amber', labelKey: 'embeddedAuth.branding.accentAmber', accent: { hue: 62, l: 0.55, c: 0.17 } },
  { id: 'green', labelKey: 'embeddedAuth.branding.accentGreen', accent: { hue: 165, l: 0.51, c: 0.14 } },
  { id: 'teal', labelKey: 'embeddedAuth.branding.accentTeal', accent: { hue: 195, l: 0.55, c: 0.105 } },
  { id: 'blue', labelKey: 'embeddedAuth.branding.accentBlue', accent: { hue: 255, l: 0.55, c: 0.16 } },
  { id: 'violet', labelKey: 'embeddedAuth.branding.accentViolet', accent: { hue: 300, l: 0.56, c: 0.17 } },
];

interface BrandingSectionProps {
  branding: EmbeddedAuthBranding;
  hideBranding: boolean;
  onChange: (next: EmbeddedAuthBranding) => void;
  onHideBrandingChange: (value: boolean) => void;
  /** Visible field errors keyed by backend path (`branding.logo_url`, `branding.accent.l`…). */
  errors: Record<string, string>;
  /** Swatch scheme (the admin's own light/dark). */
  scheme: 'light' | 'dark';
}

/** How the components look: name, logo, accent, theme, layout, language. */
export function BrandingSection({
  branding,
  hideBranding,
  onChange,
  onHideBrandingChange,
  errors,
  scheme,
}: BrandingSectionProps) {
  const { t } = useI18n();
  const set = <K extends keyof EmbeddedAuthBranding>(key: K, value: EmbeddedAuthBranding[K]) =>
    onChange({ ...branding, [key]: value });

  const accent = branding.accent;
  const preset = ACCENT_PRESETS.find((p) => sameAccent(p.accent, accent));
  const isCustom = !preset;
  const custom = accent === 'neutral' ? { ...DEFAULT_ACCENT } : accent;
  const setCustom = (key: 'hue' | 'l' | 'c', value: number) => set('accent', { ...custom, [key]: value });

  // The accent picker is one radio group (presets + "custom"): a single tab
  // stop on the selected option, arrows move AND select (WAI-ARIA radio group).
  const accentIds = [...ACCENT_PRESETS.map((p) => p.id), 'custom'];
  const selectedAccentId = preset?.id ?? 'custom';
  const accentRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const selectAccent = (id: string) => {
    const p = ACCENT_PRESETS.find((x) => x.id === id);
    if (p) set('accent', p.accent === 'neutral' ? 'neutral' : { ...p.accent });
    else if (!isCustom) set('accent', { ...custom, hue: (custom.hue + 30) % 360 });
  };
  const onAccentKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const from = accentIds.indexOf(selectedAccentId);
    let to: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        to = (from + 1) % accentIds.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        to = (from - 1 + accentIds.length) % accentIds.length;
        break;
      case 'Home':
        to = 0;
        break;
      case 'End':
        to = accentIds.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    selectAccent(accentIds[to]);
    accentRefs.current[accentIds[to]]?.focus();
  };
  const logoOk = branding.logo_url.trim() !== '' && checkLogoUrl(branding.logo_url) === null;
  const nameLength = [...branding.name.trim()].length;

  return (
    <div className="space-y-6">
      <FormField
        label={t('embeddedAuth.branding.name')}
        description={t('embeddedAuth.branding.nameDesc', { count: nameLength, max: EMBEDDED_AUTH_LIMITS.maxNameLength })}
        error={errors['branding.name']}
      >
        <Input
          value={branding.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder={t('embeddedAuth.branding.namePlaceholder')}
        />
      </FormField>

      <FormField
        label={t('embeddedAuth.branding.logoUrl')}
        description={t('embeddedAuth.branding.logoUrlDesc')}
        error={errors['branding.logo_url']}
      >
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'h-control-md w-control-md shrink-0 rounded-md flex items-center justify-center overflow-hidden border border-border',
              !logoOk && 'bg-bg-subtle'
            )}
          >
            {logoOk ? (
              // eslint-disable-next-line @next/next/no-img-element -- arbitrary external URL typed by the operator
              <img src={branding.logo_url.trim()} alt="" className="size-full object-contain" />
            ) : (
              <ImageIcon className="w-4 h-4 text-text-muted" />
            )}
          </div>
          <Input
            value={branding.logo_url}
            onChange={(e) => set('logo_url', e.target.value)}
            placeholder="https://app.example.com/logo.svg"
            spellCheck={false}
            inputMode="url"
            wrapperClassName="flex-1"
            className="font-mono text-xs"
          />
        </div>
      </FormField>

      <div className="space-y-3">
        <div>
          <Text variant="label" as="div">{t('embeddedAuth.branding.accent')}</Text>
          <Text variant="caption" tone="muted" as="div" className="mt-0.5">
            {t('embeddedAuth.branding.accentDesc')}
          </Text>
        </div>
        <div
          role="radiogroup"
          aria-label={t('embeddedAuth.branding.accent')}
          className="flex flex-wrap gap-2"
          onKeyDown={onAccentKeyDown}
        >
          {ACCENT_PRESETS.map((p) => {
            const selected = preset?.id === p.id;
            return (
              <button
                key={p.id}
                ref={(el) => {
                  accentRefs.current[p.id] = el;
                }}
                type="button"
                role="radio"
                aria-checked={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => selectAccent(p.id)}
                className={cn(
                  'inline-flex h-control-md items-center gap-2 rounded-md border px-2.5 text-label transition-colors',
                  selected ? 'border-accent-solid bg-surface-hover text-text' : 'border-border text-text-secondary hover:bg-surface-hover'
                )}
              >
                <span
                  aria-hidden
                  className="grid size-4 place-items-center rounded-full border border-border-strong"
                  style={{ background: accentCss(p.accent, scheme) }}
                >
                  {selected && <Check className="size-3" style={{ color: scheme === 'dark' && p.accent === 'neutral' ? '#000' : '#fff' }} />}
                </span>
                {t(p.labelKey)}
              </button>
            );
          })}
          <button
            ref={(el) => {
              accentRefs.current.custom = el;
            }}
            type="button"
            role="radio"
            aria-checked={isCustom}
            tabIndex={isCustom ? 0 : -1}
            onClick={() => selectAccent('custom')}
            className={cn(
              'inline-flex h-control-md items-center gap-2 rounded-md border px-2.5 text-label transition-colors',
              isCustom ? 'border-accent-solid bg-surface-hover text-text' : 'border-border text-text-secondary hover:bg-surface-hover'
            )}
          >
            <span
              aria-hidden
              className="size-4 rounded-full border border-border-strong"
              style={{ background: 'conic-gradient(oklch(0.62 0.17 0), oklch(0.62 0.17 120), oklch(0.62 0.17 240), oklch(0.62 0.17 360))' }}
            />
            {t('embeddedAuth.branding.accentCustom')}
          </button>
        </div>

        {isCustom && (
          <div className="grid gap-4 rounded-lg border border-border p-4">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="h-8 w-14 shrink-0 rounded-md border border-border"
                style={{ background: accentCss(custom, scheme) }}
              />
              <Text variant="code" tone="muted">
                oklch({custom.l} {custom.c} {custom.hue})
              </Text>
            </div>
            <FormField label={t('embeddedAuth.branding.hue')} error={errors['branding.accent.hue']}>
              <Slider
                value={custom.hue}
                onValueChange={(v) => setCustom('hue', v)}
                min={ACCENT_RANGE.hue.min}
                max={ACCENT_RANGE.hue.max}
                step={1}
                valueLabel={t('embeddedAuth.branding.hue')}
              />
            </FormField>
            <FormField label={t('embeddedAuth.branding.lightness')} error={errors['branding.accent.l']}>
              <Slider
                value={custom.l}
                onValueChange={(v) => setCustom('l', v)}
                min={ACCENT_RANGE.l.min}
                max={ACCENT_RANGE.l.max}
                step={0.01}
                valueLabel={t('embeddedAuth.branding.lightness')}
              />
            </FormField>
            <FormField label={t('embeddedAuth.branding.chroma')} error={errors['branding.accent.c']}>
              <Slider
                value={custom.c}
                onValueChange={(v) => setCustom('c', v)}
                min={ACCENT_RANGE.c.min}
                max={ACCENT_RANGE.c.max}
                step={0.005}
                valueLabel={t('embeddedAuth.branding.chroma')}
              />
            </FormField>
          </div>
        )}
        {errors['branding.accent'] && (
          <Text variant="caption" as="div" className="text-danger" role="alert">
            {errors['branding.accent']}
          </Text>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label={t('embeddedAuth.branding.theme')} error={errors['branding.theme']}>
          <Select
            value={branding.theme}
            onValueChange={(v) => set('theme', (v ?? 'system') as EmbeddedAuthTheme)}
            items={[
              { value: 'system', label: t('embeddedAuth.branding.themeSystem') },
              { value: 'light', label: t('embeddedAuth.branding.themeLight') },
              { value: 'dark', label: t('embeddedAuth.branding.themeDark') },
            ]}
          />
        </FormField>
        <FormField label={t('embeddedAuth.branding.layout')} error={errors['branding.layout']}>
          <Select
            value={branding.layout}
            onValueChange={(v) => set('layout', (v ?? 'card') as EmbeddedAuthLayout)}
            items={[
              { value: 'card', label: t('embeddedAuth.branding.layoutCard') },
              { value: 'split', label: t('embeddedAuth.branding.layoutSplit') },
            ]}
          />
        </FormField>
        <FormField label={t('embeddedAuth.branding.locale')} error={errors['branding.locale']}>
          <Select
            value={branding.locale}
            onValueChange={(v) => set('locale', (v ?? 'es') as EmbeddedAuthLocale)}
            items={[
              { value: 'es', label: t('embeddedAuth.branding.localeEs') },
              { value: 'en', label: t('embeddedAuth.branding.localeEn') },
            ]}
          />
        </FormField>
      </div>

      <div className="rounded-xl border border-border p-4">
        <Switch
          checked={hideBranding}
          onCheckedChange={(value) => onHideBrandingChange(value === true)}
          label={t('embeddedAuth.branding.hideBranding')}
          description={t('embeddedAuth.branding.hideBrandingDesc')}
        />
      </div>
    </div>
  );
}
