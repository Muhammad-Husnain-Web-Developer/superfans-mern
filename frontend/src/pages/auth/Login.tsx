import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { login } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import { AuthShell, localeLogo } from './AuthShell';
import { LoginLoader } from '../../components/LoginLoader';
import { postLoginPath } from '../../utils/postLoginRedirect';

/**
 * The one-shot "invite a friend" modal that appears on the wall after a login
 * (sessionStorage key `referralUsername`, read by Profile.tsx).
 *
 * Paused at the client's request — 26 Sep 2026, "abhi ke liye zaroori nahi, kuch
 * time ke baad dekhenge". Flipping this back to `true` restores it whole; nothing
 * else has to be touched.
 */
const REFERRAL_MODAL_ENABLED = false;
/**
 * A short, deterministic fingerprint of an email — the same FNV-1a the walls use
 * for postNoise. It is not a security token; it only names, in a cookie, whose
 * login already showed the loader this browser session.
 *
 * Using it rather than the email itself keeps the address out of a cookie that
 * rides along on every request to our own server, where nothing needs it.
 */
function emailHash(email: string): string {
  let h = 2166136261;
  const key = email.trim().toLowerCase();
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/** Pixel parity with resources/views/auth/login.blade.php */
export function Login() {
  const { t, i18n } = useTranslation('auth');
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /* the one-per-session loader — drawn over the form while the login runs */
  const [loaderOpen, setLoaderOpen] = useState(false);
  const [loaderFading, setLoaderFading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    /* The loader plays once per (browser session, email). A session cookie (no
       Max-Age) carries the "session" half — cleared when the browser closes, so
       the next visit starts fresh. Storing which email already saw it carries the
       "email" half — so Momin signs back in and it stays down, Hasan signs in on
       the same machine and it plays again. */
    const currentHash = emailHash(email);
    const cookiePair = document.cookie
      .split('; ')
      .find((c) => c.startsWith('sf_login_loader_seen='));
    const seenHash = cookiePair ? cookiePair.slice('sf_login_loader_seen='.length) : '';
    const showLoader = seenHash !== currentHash;
    const startedAt = Date.now();
    if (showLoader) setLoaderOpen(true);

    try {
      const user = await login({ email, password });

      if (showLoader) {
        /* the bar takes 2s to fill; do not flash by in half that on a fast API.
           Must match FILL_MS in LoginLoader.tsx. */
        const remaining = Math.max(0, 2000 - (Date.now() - startedAt));
        if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
        /* set the flag as a session cookie the moment the login is a success —
           its value is THIS email's hash, so a different account on the same
           browser does not match and the loader plays for them too */
        document.cookie = `sf_login_loader_seen=${currentHash}; path=/; SameSite=Lax`;
        setLoaderFading(true);
        await new Promise((r) => setTimeout(r, 250));
      }

      setUser(user);
      /* Laravel flashes show_referral_modal on login; mimic the one-shot with
         sessionStorage so the wall shows the "invite a friend" modal once after
         login. Gated by the flag above — paused at the client's request. */
      if (REFERRAL_MODAL_ENABLED && user.usernameUrl) {
        sessionStorage.setItem('referralUsername', user.usernameUrl);
      }
      navigate(postLoginPath(user.role), { replace: true });
    } catch (err) {
      /* A failed login never shows the loader all the way — clear it before the
         error is printed, so the two are never on screen together. */
      setLoaderOpen(false);
      setLoaderFading(false);
      /* Laravel answers a bad login with the localised auth.failed line from its lang files;
         our API says "Invalid credentials" in English whatever the language, so the wording
         comes from the locale file here. Any other refusal — a suspended account, say —
         keeps whatever the server said, since only this one has a translation. */
      const status = isAxiosError(err) ? err.response?.status : undefined;
      const serverMessage = isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message
        : undefined;
      setError(status === 401 || !serverMessage ? t('failed') : serverMessage);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell variant="login">
      {/* the one-per-session loading screen, drawn over the form while login runs */}
      {loaderOpen && <LoginLoader fading={loaderFading} />}
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
