import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { FlagLanguageDropdown } from './AuthShell';
import './auth.css';

/**
 * Pixel parity with resources/views/auth/passwords/email.blade.php
 * (uses the "Superfans Titulo" logo and an en/es-only language dropdown, as the original).
 */
export function ForgotPassword() {
  const { t } = useTranslation('auth');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data } = await api.post<{ success: boolean; message: string }>(
        '/auth/forgot-password',
        { email },
      );
      setStatus(data.message);
    } catch {
      setStatus('We have emailed your password reset link!');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <FlagLanguageDropdown locales={['en', 'es']} />
      <div className="auth-container">
        <div className="auth-row">
          <div className="auth-col">
            <div className="auth-card">
              <div className="auth-card-body">
                <form onSubmit={(e) => void onSubmit(e)}>
                  <div className="auth-logo-wrap">
                    <a href="https://superfans.world/">
                      <img
                        src="/brand/logos/Superfans-Titulo-01.svg"
                        className="auth-logo-reset"
                        alt="Superfans"
                      />
                    </a>
                  </div>

                  <h1 className="auth-title">{t('Reset_title', { defaultValue: 'Reset Password' })}</h1>
                  <p className="auth-subtitle">
                    {t('Reset_des', {
                      defaultValue: 'Enter your email and we will send you a reset link.',
                    })}
                  </p>

                  {status && <div className="custom-status-message">{status}</div>}

                  <div className="auth-form-group">
                    <input
                      id="email"
                      type="email"
                      placeholder={t('enter_email')}
                      className="auth-input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>

                  <button type="submit" className="btn-reset-red" disabled={submitting}>
                    {t('Reset_btn', { defaultValue: 'Send Password Reset Link' })}
                  </button>
                </form>

                <div className="auth-bottom-text">
                  <Link to="/login" className="auth-link">
                    {t('Reset_back', { defaultValue: 'Back to login' })}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
