import { useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { api } from '../../api/client';
import { localeLogo } from './AuthShell';
import './auth.css';

/** Pixel parity with resources/views/auth/passwords/reset.blade.php */
export function ResetPassword() {
  const { i18n } = useTranslation('auth');
  const { token } = useParams<{ token: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const [email, setEmail] = useState(params.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== passwordConfirm) {
      setError('The password confirmation does not match.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/auth/reset-password', { email, token, password });
      navigate('/login', { replace: true });
    } catch (err) {
      const message = isAxiosError(err)
        ? ((err.response?.data as { message?: string } | undefined)?.message ??
          'This password reset token is invalid.')
        : 'This password reset token is invalid.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-row">
          <div className="auth-col">
            <div className="auth-card">
              <div className="auth-card-body">
                <div className="auth-logo-wrap">
                  <a href="https://superfans.world/">
                    <img
                      src={localeLogo(i18n.resolvedLanguage ?? 'en')}
                      className="auth-logo-reset"
                      alt="Superfans World"
                    />
                  </a>
                </div>

                <h1 className="auth-title">Reset Password</h1>
                <p className="auth-subtitle">Enter your new password below.</p>

                <form onSubmit={(e) => void onSubmit(e)}>
                  <div className="auth-form-group">
                    <input
                      id="email"
                      type="email"
                      placeholder="Your email"
                      className={`auth-input${error ? ' is-invalid' : ''}`}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      autoFocus
                    />
                    {error && <div className="invalid-feedback">{error}</div>}
                  </div>

                  <div className="auth-form-group">
                    <input
                      id="password"
                      type="password"
                      placeholder="New password"
                      className="auth-input"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                  </div>

                  <div className="auth-form-group">
                    <input
                      id="password-confirm"
                      type="password"
                      placeholder="Confirm new password"
                      className="auth-input"
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                  </div>

                  <button type="submit" className="btn-reset-red" disabled={submitting}>
                    Reset Password
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
