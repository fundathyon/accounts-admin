export type Locale = 'es' | 'en';

export const SUPPORTED_LOCALES: { code: Locale; label: string }[] = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
];

export const DEFAULT_LOCALE: Locale = 'es';
