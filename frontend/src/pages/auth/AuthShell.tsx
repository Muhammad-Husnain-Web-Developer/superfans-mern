import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import './auth.css';
import { useStandalonePageStyles, BOOTSTRAP4_CDN } from '../../components/StandalonePage';
import { SwAdsLoader } from '../../components/SwAdsLoader';

/** Locale → logo mapping from the Blade templates (fallback: English). */
const LOGOS: Record<string, string> = {
  en: 'Superworld-13.svg',
  it: 'Superworld-14.svg',
  es: 'Superworld-15.svg',
  pt: 'Superworld-15.svg',
  ca: 'Superworld-16.svg',
  fr: 'Superworld-17.svg',
  de: 'Superworld-18.svg',
};

const FLAGS: Record<string, string> = {
  en: 'euflag.png',
  es: 'spainflag.png',
  fr: 'fr.png',
  de: 'de.png',
  it: 'it.png',
  pt: 'pt.png',
  ca: 'ca.png',
  cn: 'cn.png',
  nl: 'nl.png',
  ru: 'ru.png',
};

const LOCALE_ORDER = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ca', 'cn', 'nl', 'ru'];

export function localeLogo(locale: string): string {
  return `/brand/logos/${LOGOS[locale] ?? LOGOS.en}`;
}

/** White full-screen loader with the locale logo, fading out on mount (as the Blade pages do on window load). */
function PageLoader() {
  const { i18n } = useTranslation();
  const { t: tUi } = useTranslation('ui');
  const [faded, setFaded] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const fade = requestAnimationFrame(() => setFaded(true));
    const hide = setTimeout(() => setGone(true), 400);
    return () => {
      cancelAnimationFrame(fade);
      clearTimeout(hide);
    };
  }, []);

  if (gone) return null;
  return (
    <div
      className="auth-loader"
      style={{ transition: 'opacity 2.6s ease', opacity: faded ? 0 : 1 }}
    >
      <img src={localeLogo(i18n.resolvedLanguage ?? 'en')} alt={tUi('loading')} />
    </div>
  );
}

/** Flag language switcher fixed at bottom-right, opening upward (as in the Blade pages). */
export function FlagLanguageDropdown({ locales = LOCALE_ORDER }: { locales?: string[] }) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const current = i18n.resolvedLanguage ?? 'en';

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);

  return (
    <div className="language-dropdownz">
      <button
        type="button"
        className="dropdown-toggle"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <img src={`/flags/${FLAGS[current] ?? FLAGS.en}`} alt={current} />
      </button>
      <div className={`dropdown-menu${open ? ' show' : ''}`}>
        {locales.filter((l) => l !== current).map((locale) => (
          <a
            key={locale}
            href={`#${locale}`}
            onClick={(e) => {
              e.preventDefault();
              void i18n.changeLanguage(locale);
              setOpen(false);
            }}
          >
            <img src={`/flags/${FLAGS[locale]}`} alt={locale} />
          </a>
        ))}
      </div>
    </div>
  );
}

interface AuthShellProps {
  children: ReactNode;
  /** register page uses blue input focus + no bounty link */
  variant?: 'login' | 'register';
  /** long registration forms: row grows with content instead of clipping at 90vh */
  tall?: boolean;
  /** the Super-Ads business pages load behind the SW ADS icon */
  swAdsLoader?: boolean;
}

/**
 * Standalone auth page shell — replicates the Blade login/register pages:
 * white page, centered borderless 30px-radius card at 90vh, loader overlay,
 * flag dropdown bottom-right, bounty-hunter mail link (login only).
 */
export function AuthShell({
  children,
  variant = 'login',
  tall = false,
  swAdsLoader = false,
}: AuthShellProps) {
  /* The auth blades are standalone: no @extends, Bootstrap 4 from the CDN. Without
     this the local Bootstrap 3 keeps applying (it sets html { font-size: 10px },
     which halves every rem on the page). */
  useStandalonePageStyles([BOOTSTRAP4_CDN]);

  return (
    <div className={`auth-page${variant === 'register' ? ' auth-page--register' : ''}`}>
      {/* the two Super-Ads business pages load behind the SW ADS icon instead
          (client request); every other page that shares this shell keeps the
          Superworld logo the blades show */}
      {swAdsLoader ? <SwAdsLoader /> : <PageLoader />}
      {variant === 'login' && (
        <div className="cazarrecompensas">
          <span>
            <a href="mailto:hello@superfanss.app?subject=Solicitud:%20Cuenta%20de%20Cazarrecompensas&body=Solicito%20una%20cuenta%20de%20🕵🏽Cazarrecompensas%20para%20obtener%20ingresos">
              🕵🏽
            </a>
          </span>
        </div>
      )}
      <FlagLanguageDropdown />
      <div className="auth-container">
        <div className={`auth-row${tall ? ' auth-row--form' : ''}`}>
          <div className="auth-col">
            <div className={`auth-card${tall ? ' auth-card--form' : ''}`}>
              <div className="auth-card-body">{children}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
