import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { login } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import { AuthShell, localeLogo } from './AuthShell';
import { useStandalonePageStyles } from '../../components/StandalonePage';
import { postLoginPath } from '../../utils/postLoginRedirect';

/** Pixel parity with resources/views/auth/business_login.blade.php (grey business button). */
export function BusinessLogin() {
  /* business_login.blade.php:22 links Anton for the subtitle below. The two
     business pages are the only auth blades that do — login and register carry
     no such link — so it belongs here rather than in AuthShell. The layout
     sheets are left alone. */
  useStandalonePageStyles(
    ['https://fonts.googleapis.com/css2?family=Anton&family=BBH+Sans+Bogle&display=swap'],
    false,
  );
  const { t, i18n } = useTranslation('auth');
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await login({ email, password });
      setUser(user);
      navigate(postLoginPath(user.role), { replace: true });
    } catch (err) {
      const message = isAxiosError(err)
        ? ((err.response?.data as { message?: string } | undefined)?.message ??
          'These credentials do not match our records.')
        : 'These credentials do not match our records.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell variant="login" swAdsLoader>
      <form onSubmit={(e) => void onSubmit(e)}>
        <div className="auth-logo-wrap">
          <a href="https://superfans.world/">
            <img
              src={localeLogo(i18n.resolvedLanguage ?? 'en')}
              style={{ width: '54%', marginBottom: 2 }}
              alt="Superfans World"
            />
          </a>
          {/* no letterSpacing: the blade's `letter-spacing: -0.3` has no unit and
              is invalid, so Laravel renders this at the default spacing */}
          <h6 style={{ fontFamily: '"Anton", sans-serif', fontWeight: 550, fontSize: 19, color: '#333', marginBottom: 21 }}>
            SUPER ADS CENTER
          </h6>
        </div>

        <h1 className="auth-title">{t('Login_title')}</h1>
        <p className="auth-subtitle">{t('LoginBusiness_des')}</p>

        <div className="auth-form-group">
          <input
            type="email"
            placeholder={t('enter_email')}
            className={`auth-input${error ? ' is-invalid' : ''}`}
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {error && <div className="invalid-feedback">{error}</div>}
        </div>

        <div className="auth-form-group">
          <input
            type="password"
            placeholder={t('enter_pass')}
            className="auth-input"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <Link to="/password/reset" className="auth-link">
          {t('Login_forgotpass')}
        </Link>

        <button type="submit" className="btn-business" disabled={submitting}>
          {t('LoginB_btn')}
        </button>
      </form>

      <div className="auth-bottom-text">
        <p>
          {t('Login_have_account')}{' '}
          <Link to="/business/register" className="auth-link">
            <span>{t('Login_create_btn')}</span>
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
