import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { register as apiRegister, type RegisterInput } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import { AuthShell, localeLogo } from './AuthShell';
import { useStandalonePageStyles } from '../../components/StandalonePage';
import { CropModal } from './CropModal';
import { CustomFile, readAndValidateImage } from './RegisterForm';
import { PhoneField } from '../../components/PhoneField';

/**
 * The blade's `Swal.fire('…')` — SweetAlert2 11.3.6, which the register pages load from a
 * CDN. Its default popup is white with grey lettering and a single confirm button; the
 * cross is SweetAlert2's own `showCloseButton`, which the client asked for here.
 */
function Swal({ message, onClose }: { message: string; onClose: () => void }) {
  const { t: tUi } = useTranslation('ui');
  return (
    <div className="swal-overlay" onClick={onClose}>
      <div className="swal-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="swal-close" onClick={onClose} aria-label={tUi('close')}>
          ×
        </button>
        <div className="swal-title">{message}</div>
        <button type="button" className="swal-confirm" onClick={onClose}>
          OK
        </button>
      </div>
    </div>
  );
}


/** Pixel parity with resources/views/auth/business_register.blade.php */
export function BusinessRegister() {
  /* business_register.blade.php:24 — same Anton link as the business login page */
  useStandalonePageStyles(
    ['https://fonts.googleapis.com/css2?family=Anton&family=BBH+Sans+Bogle&display=swap'],
    false,
  );
  const { t, i18n } = useTranslation('auth');
  const { t: tUi } = useTranslation('ui');
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [dni, setDni] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [terms, setTerms] = useState(false);
  const [swal, setSwal] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [profileFilename, setProfileFilename] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  async function submit() {
    if (!name) return setSwal('Name is required');
    if (!email) return setSwal('Email is required');
    if (!dni) return setSwal('DNI is required');
    if (!address) return setSwal('Address is required');
    if (!username) return setSwal('Username is required');
    if (password !== passwordConfirm) return setSwal('Password not matched');
    if (password.length < 8) return setSwal('Password should be greater than 8 characters');
    /* business_register.blade.php:721 — the blade's own sentence. `agree_terms`
       is the checkbox's label ("I agree to the"), which read as a cut-off message. */
    if (!terms) return setSwal('Please accept the Terms and Conditions to proceed.');

    setSubmitting(true);
    try {
      const input: RegisterInput & Record<string, unknown> = {
        role: 'business',
        name,
        email,
        password,
        acceptedTerms: true,
        usernameUrl: username,
        dni,
        address,
        ...(profileFilename ? { profilePicture: profileFilename } : {}),
        ...(companyName ? { companyName } : {}),
        ...(companyId ? { companyId } : {}),
        ...(phone ? { number: phone, phone } : {}),
      };
      const user = await apiRegister(input);
      setUser(user);
      navigate('/', { replace: true });
    } catch (err) {
      const message = isAxiosError(err)
        ? ((err.response?.data as { message?: string } | undefined)?.message ?? 'Registration failed')
        : 'Registration failed';
      setSwal(message.includes('Email already') ? 'email already exists' : message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell variant="register" tall swAdsLoader>
      {swal && <Swal message={swal} onClose={() => setSwal(null)} />}
      {cropSrc && (
        <CropModal
          imageSrc={cropSrc}
          pictureType="profile"
          onClose={() => setCropSrc(null)}
          onUploaded={(filename) => {
            setProfileFilename(filename);
            setCropSrc(null);
          }}
        />
      )}
      <div className="auth-logo-wrap">
        <a href="https://superfans.world/">
          <img
            src={localeLogo(i18n.resolvedLanguage ?? 'en')}
            style={{ width: '53%', marginBottom: 2 }}
            alt="Superfans World"
          />
        </a>
        {/* unitless `letter-spacing: -0.3` in the blade — see BusinessLogin */}
        <h6 style={{ fontFamily: '"Anton", sans-serif', fontWeight: 550, fontSize: 19, color: '#333', marginBottom: 21 }}>
          {t('superadscenter', { ns: 'content' })}
        </h6>
      </div>

      <p className="auth-subtitle">{t('register_description')}</p>

      <div className="auth-form-group">
        <input
          type="text"
          placeholder={t('enter_name')}
          className="auth-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="auth-form-group">
        <input
          type="email"
          placeholder={t('enter_email')}
          className="auth-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>
      <div className="auth-form-group">
        <input
          type="password"
          placeholder={t('enter_pass')}
          className="auth-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
        />
      </div>
      <div className="auth-form-group">
        <input
          type="password"
          placeholder={t('confirm_password')}
          className="auth-input"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          required
          autoComplete="new-password"
        />
      </div>

      <div className="auth-form-group">
        <CustomFile
          label={profileFilename ?? t('profile_picture')}
          onFile={(f) => f && readAndValidateImage(f, setCropSrc)}
        />
      </div>

      <div className="auth-form-group">
        <input
          type="text"
          placeholder={tUi('business_dni')}
          className="auth-input"
          value={dni}
          onChange={(e) => setDni(e.target.value)}
          required
        />
      </div>
      <div className="auth-form-group">
        <input
          type="text"
          placeholder={tUi('business_company_name')}
          className="auth-input"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
        />
      </div>
      <div className="auth-form-group">
        <input
          type="text"
          placeholder={tUi('business_cif')}
          className="auth-input"
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
        />
      </div>
      <div className="auth-form-group">
        <input
          type="text"
          placeholder={tUi('business_address')}
          className="auth-input"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
        />
      </div>
      <div className="auth-form-group">
        <PhoneField
          id="phoneField"
          placeholder={t('enter_number')}
          className="auth-input"
          value={phone}
          onChange={setPhone}
          required
        />
      </div>
      <div className="auth-form-group">
        <input
          type="text"
          placeholder={t('choose_username_url')}
          className="auth-input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
      </div>

      <div className="auth-terms">
        <input
          type="checkbox"
          id="termsCheckbox"
          checked={terms}
          onChange={(e) => setTerms(e.target.checked)}
          required
        />
        <label htmlFor="termsCheckbox">
          {t('agree_terms')}{' '}
          <a href="https://superfans.world/terminosdeuso" target="_blank" rel="noreferrer">
            {t('terms_and_conditions')}
          </a>
        </label>
      </div>

      <br />
      <button
        type="button"
        className="btn-business btn-business--register"
        disabled={submitting}
        onClick={() => void submit()}
      >
        {t('register_btn')}
      </button>

      <div className="auth-bottom-text">
        <p>
          {t('already_registered')}{' '}
          <Link to="/business/login" className="auth-link">
            <span>{t('LoginB_btn')}</span>
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
