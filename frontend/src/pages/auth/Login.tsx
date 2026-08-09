import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { login } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import { AuthShell, localeLogo } from './AuthShell';
import { postLoginPath } from '../../utils/postLoginRedirect';

/** Pixel parity with resources/views/auth/login.blade.php */
export function Login() {
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
      // Laravel flashes show_referral_modal on login; mimic the one-shot with sessionStorage
      // so the wall shows the "invite a friend" modal once after login.
      if (user.usernameUrl) sessionStorage.setItem('referralUsername', user.usernameUrl);
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
    <AuthShell variant="login">
      <form onSubmit={(e) => void onSubmit(e)}>
        <div className="auth-logo-wrap">
          <a href="https://superfans.world/">
            <img
              src={localeLogo(i18n.resolvedLanguage ?? 'en')}
              className="auth-logo-login"
              alt="Superfans World"
            />
          </a>
        </div>

        <h1 className="auth-title">{t('Login_title')}</h1>
        <p className="auth-subtitle">{t('Login_des')}</p>

        <div className="auth-form-group">
          <input
            id="email"
            type="email"
            placeholder={t('enter_email')}
            className={`auth-input${error ? ' is-invalid' : ''}`}
            name="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {error && <div className="invalid-feedback">{error}</div>}
        </div>

        <div className="auth-form-group">
          <input
            id="password"
            type="password"
            placeholder={t('enter_pass')}
            className="auth-input"
            name="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <Link to="/password/reset" className="auth-link">
          {t('Login_forgotpass')}
        </Link>

        <button type="submit" id="sendlogin" className="btn-login-green" disabled={submitting}>
          <b>
            {t('Login_btn')}
            <span className="dot">..</span>
          </b>
        </button>
      </form>

      <div className="auth-bottom-text">
        <p>
          {t('Login_have_account')}{' '}
          <Link to="/register" className="auth-link">
            <span>{t('Login_create_btn')}</span>
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
