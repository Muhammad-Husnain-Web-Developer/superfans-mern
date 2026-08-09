import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { localeLogo } from './AuthShell';
import './auth.css';

/**
 * Pixel parity with resources/views/auth/influencer_r.blade.php —
 * the "are you sure you're a creator?" confirmation step (/creador/confirm).
 */
export function CreatorConfirm() {
  const { t, i18n } = useTranslation('auth');

  return (
    <div className="confirm-page">
      <div className="confirm-container">
        <Link to="/">
          <img
            src={localeLogo(i18n.resolvedLanguage ?? 'en')}
            alt="Superworld Logo"
            className="confirm-logo"
          />
        </Link>

        <h2 className="confirm-title">{t('influencer_title')}</h2>

        <p
          // The Blade template renders this string with {!! !!} (may contain markup)
          dangerouslySetInnerHTML={{ __html: t('influencer_subtitle') }}
        />

        <div className="confirm-warning" role="alert" aria-live="polite" aria-atomic="true">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
          </svg>
          {t('warning_message')}
        </div>

        <div className="confirm-btn-group">
          <Link to="/creador" className="confirm-btn confirm-btn--yes">
            {t('yes_im_popular')}
          </Link>
          <Link to="/business/register" className="confirm-btn confirm-btn--business">
            {t('soc_empresa')}
          </Link>
        </div>

        <div className="confirm-back-text">
          <p>
            <b>↖</b> {t('back_text')}{' '}
            <Link to="/register" className="auth-link">
              <span>{t('back')}</span>
            </Link>
          </p>
        </div>
      </div>

      <div className="cazarrecompensas">
        <span>
          <a href="mailto:hello@superfanss.app?subject=Solicitud:%20Cuenta%20de%20Cazarrecompensas&body=Solicito%20una%20cuenta%20de%20🕵🏽Cazarrecompensas%20para%20obtener%20ingresos">
            🕵🏽
          </a>
        </span>
      </div>
    </div>
  );
}
