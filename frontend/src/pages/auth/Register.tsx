import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthShell, localeLogo } from './AuthShell';

/**
 * Pixel parity with resources/views/auth/register.blade.php —
 * the account-type chooser (Creator → /creador, Fan → /fan).
 */
export function Register() {
  const { t, i18n } = useTranslation('auth');

  return (
    <AuthShell variant="register">
      <div className="auth-logo-wrap">
        <a href="https://superfans.world/">
          <img
            src={localeLogo(i18n.resolvedLanguage ?? 'en')}
            className="auth-logo-register"
            alt="Superfans World"
          />
        </a>
      </div>

      <h1 className="auth-title">{t('register_title')}</h1>
      <p className="auth-subtitle">{t('choose_account_type')}</p>

      <div className="auth-choose-row">
        <div className="auth-choose-col">
          <Link to="/creador/confirm" className="btn-choose btn-choose--creator">
            {t('creator')}
          </Link>
        </div>
        <div className="auth-choose-col">
          <Link to="/fan" className="btn-choose btn-choose--fan">
            {t('fan')}
          </Link>
        </div>
      </div>

      <div className="auth-bottom-text">
        <p>
          {t('already_registered')}{' '}
          <Link to="/login" className="auth-link">
            <span>{t('Login_btn')}</span>
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
