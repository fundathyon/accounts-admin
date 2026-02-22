import type { Locale } from './types';
import es from './locales/es.json';
import en from './locales/en.json';

const messages: Record<Locale, Record<string, unknown>> = {
  es: es as Record<string, unknown>,
  en: en as Record<string, unknown>,
};

export function getMessages(locale: Locale): Record<string, unknown> {
  return messages[locale] ?? messages.es;
}
