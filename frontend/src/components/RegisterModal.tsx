import { createContext, useContext, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { login as apiLogin, register as apiRegister, type RegisterInput } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { Select2Multi } from './Select2Multi';
import { assetImage } from '../utils/format';
import '../styles/footer-modals.css';
import { useLayoutPageStyles } from '../components/StandalonePage';

/**
 * Guest modal chain — exact port of footer.blade.php:
 * #register_Modal (choice) → #register_influencer_Modal ("Como Influencer" form)
 *                          → #register_fan_Modal ("Como Espectador" form)
 *                          → #login_Modal (login form)
 * All purple (#8a2be2), white inputs (.register_modal_input), back arrow returns
 * to the choice view — no page navigation, just like the blade jQuery handlers.
 */

type View = 'choice' | 'creator' | 'fan' | 'login';

const RegisterModalContext = createContext<{ open: () => void } | null>(null);

export function useRegisterModal() {
  const ctx = useContext(RegisterModalContext);
  if (!ctx) throw new Error('useRegisterModal must be used inside <RegisterModalProvider>');
  return ctx;
}

interface NetworkOption {
  id: number;
  name: string;
  defaultAddress: string;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function RegisterModalProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  /* drives the open animation: the frame mounts at its off-screen start, then
     `in` is added on the next frame so the transition actually runs */
  const [entered, setEntered] = useState(false);
  const [view, setView] = useState<View>('choice');
  /* the modal reuses the layout chrome, so pull that stylesheet in only while it is open */
  useLayoutPageStyles(visible);
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const [networks, setNetworks] = useState<NetworkOption[]>([]);
  useEffect(() => {
    if (!visible || networks.length > 0) return;
    api
      .get<{ success: boolean; data: NetworkOption[] }>('/social-networks')
      .then((r) => setNetworks(r.data.data))
      .catch(() => undefined);
  }, [visible, networks.length]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>([]);
  const [networkLinks, setNetworkLinks] = useState<Record<string, string>>({});
  const [price, setPrice] = useState('');
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [username, setUsername] = useState('');
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function open() {
    setView('choice');
    setError(null);
    setVisible(true);
  }

  useEffect(() => {
    if (!visible) {
      setEntered(false);
      return;
    }
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [visible]);

  function close() {
    setVisible(false);
    setName('');
    setEmail('');
    setPassword('');
    setPasswordConfirm('');
    setSelectedNetworks([]);
    setNetworkLinks({});
    setPrice('');
    setProfileFile(null);
    setCoverFile(null);
    setUsername('');
    setTerms(false);
    setError(null);
  }

  function linkFor(networkName: string): string {
    return networkLinks[networkName] ?? networks.find((n) => n.name === networkName)?.defaultAddress ?? '';
  }

  async function submitRegister(role: 'influencer' | 'user') {
    setError(null);
    if (!name) return setError('Name is required');
    if (!email) return setError('Email is required');
    if (password !== passwordConfirm) return setError('Password not matched');
    if (password.length < 8) return setError('Password should be greater than 8 characters');
    if (role === 'influencer' && !price) return setError('Price is required');
    if (!username) return setError('Username is required');
    if (!terms) return setError('You must accept the Terms and Conditions');

    setSubmitting(true);
    try {
      let profilePicture: string | undefined;
      let coverPicture: string | undefined;
      if (profileFile) {
        const { data } = await api.post<{ filename: string }>('/uploads/profile-image', {
          image: await fileToDataUrl(profileFile),
        });
        profilePicture = data.filename;
      }
      if (coverFile) {
        const { data } = await api.post<{ filename: string }>('/uploads/cover-image', {
          image: await fileToDataUrl(coverFile),
        });
        coverPicture = data.filename;
      }

      const input: RegisterInput & Record<string, unknown> = {
        role,
        name,
        email,
        password,
        acceptedTerms: true,
        usernameUrl: username,
        networks: selectedNetworks,
        networkProfileLinks: selectedNetworks.map((n) => linkFor(n)),
        ...(profilePicture ? { profilePicture } : {}),
        ...(coverPicture ? { coverPicture } : {}),
        ...(role === 'influencer' && price ? { priceOfSubscription: Number(price) } : {}),
      };
      const user = await apiRegister(input);
      setUser(user);
      close();
      navigate('/user', { replace: true }); // Laravel redirects new accounts to their wall
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Registration failed';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitLogin() {
    setError(null);
    setSubmitting(true);
    try {
      const user = await apiLogin({ email, password });
      setUser(user);
      close();
    } catch {
      setError('These credentials do not match our records.');
    } finally {
      setSubmitting(false);
    }
  }

  const acceptBtn: CSSProperties = {
    marginLeft: 'auto',
    display: 'block',
    fontSize: 20,
    fontWeight: 'bold',
    border: 0,
    padding: '7px 11px',
    cursor: 'pointer',
  };

  /* no inline margin — .form-group spacing comes from the original bootstrap.css, as in the blade */
  const formGroup = (children: ReactNode, key?: string) => (
    <div className="form-group" key={key}>
      {children}
    </div>
  );

  const input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} className="form-control register_modal_input" style={{ ...props.style }} />
  );

  const frame = (content: ReactNode, withBack: boolean) => (
    <div
      className={`modal register-modal${entered ? ' in' : ''}`}
      style={{
        zIndex: 123112311231,
        display: 'block',
        position: 'fixed',
        inset: 0,
        overflowY: 'auto',
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={close}
    >
      <div
        className="modal-dialog modal-dialog-centered"
        /* margin lives in footer-modals.css so the phone gutter can override it */
        style={{ maxWidth: 600 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content" style={{ borderRadius: 20, background: '#8a2be2', width: '100%' }}>
          <div className="modal-header" style={{ border: 0, display: 'block', padding: 15 }}>
            <button
              type="button"
              className="close d-block"
              aria-label="Close"
              onClick={close}
              style={{
                fontSize: 45,
                opacity: 1,
                color: 'white',
                background: 'transparent',
                border: 0,
                float: 'right',
                lineHeight: 0.6,
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              <span aria-hidden="true">×</span>
            </button>
            {withBack && (
              <button
                type="button"
                className="close d-block"
                onClick={() => {
                  setError(null);
                  setView('choice');
                }}
                style={{
                  fontSize: 45,
                  opacity: 1,
                  color: 'white',
                  background: 'transparent',
                  border: 0,
                  float: 'left',
                  marginTop: -6,
                  cursor: 'pointer',
                }}
              >
                <span aria-hidden="true">
                  <i className="fas fa-arrow-left back_register_modal" style={{ fontSize: 27 }}></i>
                </span>
              </button>
            )}
            <div style={{ textAlign: 'center', height: 20 }}>
              <img src={assetImage('superman2.png')} style={{ display: 'inline-block', height: 51 }} alt="" />
              <h5
                className="modal-title"
                style={{ fontSize: 30, textAlign: 'center', color: 'white', display: 'inline-block' }}
              >
                {view === 'login' ? 'Login' : 'Regístrate'}
              </h5>
            </div>
          </div>
          <div className="modal-body" style={{ border: 0, padding: 15 }}>
            <br />
            <div style={{ color: 'white' }}>
              <div className="card" style={{ borderRadius: 30, border: 0, padding: 0, background: 'transparent' }}>
                <div className="card-body" style={{ padding: 0 }}>
                  {error && (
                    <div
                      style={{
                        background: '#fff',
                        color: '#dc3545',
                        borderRadius: 6,
                        padding: '8px 12px',
                        marginBottom: 12,
                        fontSize: 14,
                        textAlign: 'center',
                      }}
                    >
                      {error}
                    </div>
                  )}
                  {content}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const choiceView = (
    <>
      <h1 className="mb-3" style={{ textAlign: 'center', marginBottom: '0.5rem', color: 'white' }}>
        Primero, crea tu cuenta
      </h1>
      <p style={{ textAlign: 'center' }}>Es muy rápido. Elige un tipo de cuenta.</p>
      <div className="container-fluid">
        <div className="row" style={{ display: 'flex' }}>
          <div className="col-md-6" style={{ flex: 1 }}>
            <span
              className="new_button_hover1 btn"
              onClick={() => setView('creator')}
              style={{ display: 'block', fontSize: 20, margin: '0 auto', cursor: 'pointer', textAlign: 'center' }}
            >
              Creador
            </span>
          </div>
          <div className="col-md-6" style={{ flex: 1 }}>
            <span
              className="new_button_hover2 btn"
              onClick={() => setView('fan')}
              style={{
                display: 'block',
                fontSize: 20,
                paddingLeft: 30,
                paddingRight: 30,
                margin: '0 auto',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              Fan
            </span>
          </div>
        </div>
      </div>
      <div className="text-center mt-4" style={{ textAlign: 'center' }}>
        <br />
        <p style={{ marginBottom: 20 }}>
          Already Registered?{' '}
          <span className="button_hover_underlined" onClick={() => setView('login')} style={{ fontWeight: 'bold' }}>
            <span style={{ cursor: 'pointer' }}>Login</span>
          </span>
        </p>
      </div>
    </>
  );

  /* blade: <label>Social Networks</label> + select2-enhanced multi select */
  const networksField = (suffix: string) => (
    <>
      {formGroup(
        <>
          <label htmlFor="">Social Networks</label>
          <Select2Multi
            id={`social_networks${suffix}`}
            options={networks.map((n) => n.name)}
            selected={selectedNetworks}
            onChange={setSelectedNetworks}
          />
        </>,
      )}
      <div className="form-group my-4">
        {selectedNetworks.map((n) => (
          <input
            key={n}
            type="text"
            className="form-control register_modal_input social_links2"
            placeholder={`Enter your ${n} Link`}
            value={linkFor(n)}
            onChange={(e) => setNetworkLinks({ ...networkLinks, [n]: e.target.value })}
            style={{ marginTop: 10 }}
          />
        ))}
      </div>
    </>
  );

  /* blade: .custom-file > native file input (.register_modal_input) + label below it */
  const fileField = (
    kind: 'profile' | 'cover',
    label: string,
    file: File | null,
    setFile: (f: File | null) => void,
  ) => (
    <div className="form-group">
      <div className="custom-file">
        <input
          type="file"
          accept="image/*"
          className={`custom-file-input register_modal_input ${kind}_picture`}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <label className="custom-file-label">{file?.name ?? label}</label>
      </div>
    </div>
  );

  const termsField = (
    <div className="col-12 col-md-12 form-group expiration required" style={{ padding: 0 }}>
      <input
        className="form-check-input"
        type="checkbox"
        id="termsCheckboxModal"
        checked={terms}
        onChange={(e) => setTerms(e.target.checked)}
        style={{ height: 'auto' }}
      />{' '}
      <label className="form-check-label" htmlFor="termsCheckboxModal" style={{ color: 'white' }}>
        I agree to the{' '}
        <a style={{ color: 'purple' }} href="https://superfans.world/terminosdeuso" target="_blank" rel="noreferrer">
          Terms and Conditions
        </a>
      </label>
    </div>
  );

  const creatorView = (
    <form onSubmit={(e) => e.preventDefault()}>
      <h1 className="mb-3" style={{ textAlign: 'center', color: 'white', marginBottom: '0.5rem' }}>
        Como Influencer
      </h1>
      <p style={{ color: 'white', textAlign: 'center' }}>Rellena los campos para el alta.</p>
      {formGroup(input({ type: 'text', placeholder: 'Introduce tu nombre', required: true, value: name, onChange: (e) => setName(e.target.value) }))}
      {formGroup(input({ type: 'email', placeholder: 'Introduce tu email', required: true, value: email, onChange: (e) => setEmail(e.target.value) }))}
      {formGroup(input({ type: 'password', placeholder: 'Introduce una contraseña', required: true, value: password, onChange: (e) => setPassword(e.target.value) }))}
      {formGroup(input({ type: 'password', placeholder: 'Confirma la contraseña', required: true, value: passwordConfirm, onChange: (e) => setPasswordConfirm(e.target.value) }))}
      {networksField('2')}
      {formGroup(
        input({
          type: 'number',
          step: '0.01',
          min: '0.50',
          placeholder: 'Introduce tu precio de membresía',
          required: true,
          value: price,
          onChange: (e) => setPrice(e.target.value),
        }),
      )}
      {fileField('profile', 'Profile picture...', profileFile, setProfileFile)}
      {fileField('cover', 'Cover picture...', coverFile, setCoverFile)}
      {formGroup(
        input({
          type: 'text',
          placeholder: 'Choose your username or URL',
          required: true,
          value: username,
          onChange: (e) => setUsername(e.target.value),
        }),
      )}
      {termsField}
      <button
        type="button"
        className="btn new_button_hover2"
        disabled={submitting}
        onClick={() => void submitRegister('influencer')}
        style={acceptBtn}
      >
        Aceptar
      </button>
    </form>
  );

  const fanView = (
    <form onSubmit={(e) => e.preventDefault()}>
      <h1 className="mb-3" style={{ textAlign: 'center', color: 'white', marginBottom: '0.5rem' }}>
        Como Espectador
      </h1>
      <p style={{ color: 'white', textAlign: 'center' }}>Rellena los campos.</p>
      {formGroup(input({ type: 'text', placeholder: 'Introduce tu nombre', required: true, value: name, onChange: (e) => setName(e.target.value) }))}
      {formGroup(input({ type: 'email', placeholder: 'Introduce tu email', required: true, value: email, onChange: (e) => setEmail(e.target.value) }))}
      {formGroup(input({ type: 'password', placeholder: 'Introduce una contraseña', required: true, value: password, onChange: (e) => setPassword(e.target.value) }))}
      {formGroup(input({ type: 'password', placeholder: 'Confirma la contraseña', required: true, value: passwordConfirm, onChange: (e) => setPasswordConfirm(e.target.value) }))}
      {formGroup(
        input({
          type: 'text',
          placeholder: 'Choose your username or URL',
          required: true,
          value: username,
          onChange: (e) => setUsername(e.target.value),
        }),
      )}
      {termsField}
      <button
        type="button"
        className="btn new_button_hover2"
        disabled={submitting}
        onClick={() => void submitRegister('user')}
        style={acceptBtn}
      >
        Aceptar
      </button>
    </form>
  );

  /* #login_Modal: inputs carry modal_input too and kill their border inline */
  const loginView = (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submitLogin();
        }}
      >
        <h3 className="mb-3" style={{ textAlign: 'center', marginBottom: '0.5rem', color: 'white' }}>
          Inicia sesión
        </h3>
        <p style={{ textAlign: 'center', color: 'white' }}>Fill the form to login.</p>
        {formGroup(
          <input
            id="email"
            type="email"
            placeholder="Enter your email"
            className="form-control modal_input register_modal_input login-modal-input"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />,
        )}
        {formGroup(
          <input
            id="password"
            type="password"
            placeholder="Enter your password"
            className="form-control modal_input register_modal_input login-modal-input"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />,
        )}
        <div className="form-check">
          <input
            className="form-check-input"
            type="checkbox"
            id="termsCheckboxLogin"
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
            required
          />{' '}
          <label className="form-check-label" htmlFor="termsCheckboxLogin">
            I agree to the{' '}
            <a href="https://superfans.world/terminosdeuso" target="_blank" rel="noreferrer" style={{ color: 'purple' }}>
              Terms and Conditions
            </a>
          </label>
        </div>
        <button
          type="submit"
          id="sendlogin"
          className="btn btn-outline-primary new_button3"
          disabled={submitting}
          style={{ marginLeft: 'auto', display: 'block', fontSize: 20, color: '#000' }}
        >
          Login
        </button>
      </form>
      <div className="text-center mt-4">
        <br />
        <p>
          Don&apos;t have an account?{' '}
          <span
            id="open_register_modal"
            className="button_hover_underlined"
            onClick={() => {
              setError(null);
              setView('choice');
            }}
            style={{ textAlign: 'center', fontWeight: 'bold' }}
          >
            <span style={{ cursor: 'pointer' }}>Create One</span>
          </span>
        </p>
      </div>
    </>
  );

  const viewContent: Record<View, ReactNode> = {
    choice: choiceView,
    creator: creatorView,
    fan: fanView,
    login: loginView,
  };

  return (
    <RegisterModalContext.Provider value={{ open }}>
      {children}
      {/* only the two register forms carry the ← back arrow (blade: #login_Modal has none) */}
      {visible && frame(viewContent[view], view === 'creator' || view === 'fan')}
    </RegisterModalContext.Provider>
  );
}
