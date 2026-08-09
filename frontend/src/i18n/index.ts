import i18n, { type Resource, type ResourceKey } from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

export const SUPPORTED_LOCALES = ['en', 'es', 'ca', 'fr', 'de', 'it', 'pt', 'cn'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

// Eagerly bundle every locale JSON converted from the Laravel app
// (resources/lang/** → src/i18n/locales/**). Namespaces mirror the
// original files: auth, content, footer, nav, pagination, passwords, report, validation.
const modules = import.meta.glob<ResourceKey>('./locales/*/*.json', {
  eager: true,
  import: 'default',
});

const resources: Resource = {};
for (const [path, data] of Object.entries(modules)) {
  const match = path.match(/\.\/locales\/([^/]+)\/([^/]+)\.json$/);
  if (!match) continue;
  const [, locale, namespace] = match;
  resources[locale] ??= {};
  resources[locale][namespace] = data;
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: [...SUPPORTED_LOCALES],
    defaultNS: 'content',
    ns: ['auth', 'content', 'footer', 'nav', 'pagination', 'passwords', 'report', 'validation'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'sf_locale',
    },
  });

export default i18n;
