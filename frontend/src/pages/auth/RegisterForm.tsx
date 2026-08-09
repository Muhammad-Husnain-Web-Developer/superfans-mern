import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { api } from '../../api/client';
import { register as apiRegister, type RegisterInput } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import { AuthShell, localeLogo } from './AuthShell';
import { CropModal, type PictureType } from './CropModal';
import { postLoginPath } from '../../utils/postLoginRedirect';

interface SocialNetwork {
  id: number;
  name: string;
  defaultAddress: string;
}

/* ---------- sweetalert2 lookalike (purple modal from register_u.blade.php) ---------- */
function Swal({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="swal-overlay" onClick={onClose}>
      <div className="swal-modal" onClick={(e) => e.stopPropagation()}>
        <div className="swal-title">{message}</div>
        <button type="button" className="swal-confirm" onClick={onClose}>
          OK
        </button>
      </div>
    </div>
  );
}

/* ---------- select2 lookalike multi-select ---------- */
interface Select2Props {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  max?: number;
  allowTags?: boolean;
}

function Select2Multi({ options, selected, onChange, placeholder, max, allowTags }: Select2Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const atMax = max !== undefined && selected.length >= max;
  const visible = options.filter(
    (o) => !selected.includes(o) && o.toLowerCase().includes(query.toLowerCase()),
  );

  function add(option: string) {
    if (atMax) return;
    onChange([...selected, option]);
    setQuery('');
  }

  return (
    <div className="s2-box" ref={boxRef} onClick={() => setOpen(true)}>
      {selected.map((item) => (
        <span key={item} className="s2-tag">
          <button
            type="button"
            aria-label={`Remove ${item}`}
            onClick={(e) => {
              e.stopPropagation();
              onChange(selected.filter((s) => s !== item));
            }}
          >
            ×
          </button>
          {item}
        </span>
      ))}
      <input
        type="text"
        value={query}
        placeholder={selected.length === 0 ? placeholder : ''}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (allowTags && e.key === 'Enter' && query.trim()) {
            e.preventDefault();
            add(query.trim());
          }
        }}
        style={{
          border: 'none',
          outline: 'none',
          height: 26,
          fontSize: 14,
          flex: 1,
          minWidth: 60,
          fontWeight: 400,
        }}
      />
      {open && (
        <div className="s2-dropdown">
          {visible.length === 0 && !allowTags && <div className="s2-option disabled">No results</div>}
          {visible.map((o) => (
            <div
              key={o}
              className={`s2-option${atMax ? ' disabled' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                add(o);
              }}
            >
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- bootstrap-4 custom-file lookalike ---------- */
export function CustomFile({ label, onFile }: { label: string; onFile: (f: File | null) => void }) {
  return (
    <div className="custom-file-box">
      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          onFile(e.target.files?.[0] ?? null);
          e.target.value = ''; // allow re-picking the same file, as the Blade page does
        }}
      />
      <span className="custom-file-face">{label}</span>
    </div>
  );
}

/**
 * Same pre-check as the Blade page: read the file, reject images smaller
 * than 590×300 with the original alert, otherwise hand back a data URL.
 */
export function readAndValidateImage(file: File, onValid: (dataUrl: string) => void): void {
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result as string;
    const tempImage = new Image();
    tempImage.onload = () => {
      if (tempImage.width < 590 || tempImage.height < 300) {
        alert('❌ Image too small. Minimum size is 590x300 pixels.');
      } else {
        onValid(dataUrl);
      }
    };
    tempImage.src = dataUrl;
  };
  reader.readAsDataURL(file);
}

/* ---------- the shared fan/creator registration form ---------- */
export function RegisterForm({ role }: { role: 'user' | 'influencer' }) {
  const { t, i18n } = useTranslation('auth');
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const [networks, setNetworks] = useState<SocialNetwork[]>([]);
  useEffect(() => {
    api
      .get<{ success: boolean; data: SocialNetwork[] }>('/social-networks')
      .then((res) => setNetworks(res.data.data))
      .catch(() => setNetworks([]));
  }, []);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [paypalAccount, setPaypalAccount] = useState('');
  const [price, setPrice] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>([]);
  const [networkLinks, setNetworkLinks] = useState<Record<string, string>>({});
  const [username, setUsername] = useState('');
  const [referred, setReferred] = useState('');
  const [terms, setTerms] = useState(false);
  const [swal, setSwal] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [profileFilename, setProfileFilename] = useState<string | null>(null);
  const [coverFilename, setCoverFilename] = useState<string | null>(null);
  const [cropState, setCropState] = useState<{ src: string; type: PictureType } | null>(null);

  function pickImage(type: PictureType, file: File | null) {
    if (!file) return;
    readAndValidateImage(file, (dataUrl) => setCropState({ src: dataUrl, type }));
  }

  const categoriesList = t('categories_list', { returnObjects: true });
  const categoryOptions = Array.isArray(categoriesList) ? (categoriesList as string[]) : [];

  function linkFor(networkName: string): string {
    return (
      networkLinks[networkName] ?? networks.find((n) => n.name === networkName)?.defaultAddress ?? ''
    );
  }

  async function submit() {
    // Same client-side checks (and messages) as the Blade page's jQuery + Swal
    if (!name) return setSwal('Name is required');
    if (!email) return setSwal('Email is required');
    if (!username) return setSwal('Username is required');
    if (password !== passwordConfirm) return setSwal('Password not matched');
    if (password.length < 8) return setSwal('Password should be greater than 8 characters');
    if (!terms) return setSwal(t('agree_terms'));

    setSubmitting(true);
    try {
      const input: RegisterInput & Record<string, unknown> = {
        role,
        name,
        email,
        password,
        acceptedTerms: true,
        usernameUrl: username,
        categories,
        networks: selectedNetworks,
        networkProfileLinks: selectedNetworks.map((n) => linkFor(n)),
        ...(profileFilename ? { profilePicture: profileFilename } : {}),
        ...(coverFilename ? { coverPicture: coverFilename } : {}),
        ...(referred ? { referredInfluencer: referred } : {}),
        ...(role === 'influencer'
          ? {
              number: phone || undefined,
              phone: phone || undefined,
              bankAccount: bankAccount || undefined,
              paypalAccount: paypalAccount || undefined,
              ...(price ? { priceOfSubscription: Number(price) } : {}),
            }
          : {}),
      };
      const user = await apiRegister(input);
      setUser(user);
      navigate(postLoginPath(user.role), { replace: true });
    } catch (err) {
      const message = isAxiosError(err)
        ? ((err.response?.data as { message?: string } | undefined)?.message ?? 'Registration failed')
        : 'Registration failed';
      setSwal(message.includes('Email already') ? 'email already exists' : message);
    } finally {
      setSubmitting(false);
    }
  }

  const group = (children: ReactNode, key?: string) => (
    <div className="auth-form-group" key={key}>
      {children}
    </div>
  );

  return (
    <AuthShell variant="register" tall>
      {swal && <Swal message={swal} onClose={() => setSwal(null)} />}
      {cropState && (
        <CropModal
          imageSrc={cropState.src}
          pictureType={cropState.type}
          onClose={() => setCropState(null)}
          onUploaded={(filename) => {
            if (cropState.type === 'profile') setProfileFilename(filename);
            else setCoverFilename(filename);
            setCropState(null);
          }}
        />
      )}
      <div className="auth-logo-wrap">
        <a href="https://superfans.world/">
          <img
            src={localeLogo(i18n.resolvedLanguage ?? 'en')}
            className="auth-logo-form"
            alt="Superfans World"
          />
        </a>
      </div>

      <h1 className="auth-title">{role === 'user' ? t('fan_signup') : t('register_title')}</h1>
      <p className="auth-subtitle">{t('register_description')}</p>

      {group(
        <input
          id="name"
          type="text"
          placeholder={t('enter_name')}
          className="auth-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />,
      )}
      {group(
        <input
          id="email"
          type="email"
          placeholder={t('enter_email')}
          className="auth-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />,
      )}
      {role === 'influencer' &&
        group(
          <input
            id="phoneField"
            type="tel"
            placeholder={t('enter_number')}
            className="auth-input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />,
        )}
      {group(
        <input
          id="password"
          type="password"
          placeholder={t('enter_pass')}
          className="auth-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
        />,
      )}
      {group(
        <input
          id="password-confirm"
          type="password"
          placeholder={t('confirm_password')}
          className="auth-input"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          required
          autoComplete="new-password"
        />,
      )}

      {role === 'influencer' && (
        <>
          {group(
            <input
              type="text"
              placeholder={t('enter_bank_account')}
              className="auth-input"
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
            />,
          )}
          {group(
            <input
              type="text"
              placeholder={t('paypal_account')}
              className="auth-input"
              value={paypalAccount}
              onChange={(e) => setPaypalAccount(e.target.value)}
            />,
          )}
          {group(
            <input
              type="number"
              placeholder={t('enter_subscription_price')}
              className="auth-input"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />,
          )}
        </>
      )}

      {group(
        <>
          <label className="auth-label">{t('categories')}</label>
          <Select2Multi
            options={categoryOptions}
            selected={categories}
            onChange={setCategories}
            allowTags
          />
        </>,
      )}

      {group(
        <CustomFile
          label={profileFilename ?? t('profile_picture')}
          onFile={(f) => pickImage('profile', f)}
        />,
      )}
      {group(
        <CustomFile
          label={coverFilename ?? t('cover_picture')}
          onFile={(f) => pickImage('cover', f)}
        />,
      )}

      {group(
        <>
          <label className="auth-label">{t('social_networks')}</label>
          <Select2Multi
            options={networks.map((n) => n.name)}
            selected={selectedNetworks}
            onChange={setSelectedNetworks}
            max={3}
          />
        </>,
      )}

      <div className="auth-form-group" style={{ margin: '1.5rem 0' }}>
        {selectedNetworks.map((n) => (
          <input
            key={n}
            type="text"
            className="auth-input social-link-input"
            placeholder={`Enter your ${n} Link`}
            value={linkFor(n)}
            onChange={(e) => setNetworkLinks({ ...networkLinks, [n]: e.target.value })}
          />
        ))}
      </div>

      {group(
        <input
          id="Choose_username_or_URL"
          type="text"
          placeholder={t('choose_username_url')}
          className="auth-input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />,
      )}

      {role === 'influencer' &&
        group(
          <>
            <label className="auth-label">{t('invited_by')}</label>
            <input
              type="text"
              placeholder={t('influencer_username_placeholder')}
              className="auth-input"
              value={referred}
              onChange={(e) => setReferred(e.target.value)}
            />
          </>,
        )}

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
        className="btn-register-dark"
        disabled={submitting}
        onClick={() => void submit()}
      >
        <b>{t('register_btn')}</b>✨
      </button>

      <div className="auth-bottom-text">
        <p>
          <b>↖</b> {t('back_text')}{' '}
          <Link to="/register" className="auth-link">
            <span>{t('back')}</span>
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
