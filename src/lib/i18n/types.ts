export type Locale = 'es' | 'en';

export const SUPPORTED_LOCALES: { code: Locale; label: string }[] = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
];

export const DEFAULT_LOCALE: Locale = 'es';

/** The `t()` of `useI18n()`, for helpers that build copy outside a component. */
export type Translate = (key: string, params?: Record<string, string | number>) => string;
