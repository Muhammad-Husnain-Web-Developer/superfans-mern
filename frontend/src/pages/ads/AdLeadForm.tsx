import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { assetImage, isVideoFile, videoMime } from '../../utils/format';
import '../../styles/lead-form.css';

interface FormConfig {
  adId: string;
  title: string;
  /** the advertiser, drawn at the head of every step */
  company: string;
  avatar: string | null;
  /** where "Visit website" goes once the formulary is sent */
  website: string;
  askName: boolean;
  askEmail: boolean;
  askPhone: boolean;
  askCompany: boolean;
  questions: string[];
  buttonAction: string;
}

/**
 * The formulary a clients-form ad opens — built to the client's mockups (potential-mockups/
 * 7 to 10): a violet card that heads every step with the advertiser, asks one question per
 * step, then the viewer's details, then confirms.
 *
 * The name and email of a viewer who is signed in are filled in for them, as the mockup
 * shows them already carrying "$name user" and "$email of user".
 */
export function AdLeadForm({
  adId,
  media,
  link,
  onClose,
}: {
  adId: string;
  media?: string;
  link?: string;
  onClose?: () => void;
}) {
  const { user: authUser } = useAuth();
  const [cfg, setCfg] = useState<FormConfig | null>(null);
  const [step, setStep] = useState(media ? -1 : 0);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [v, setV] = useState<Record<string, string>>({});

  useEffect(() => {
    api
      .get<{ form: FormConfig }>(`/ads/formulary/${adId}`)
      .then(({ data }) => setCfg(data.form))
      .catch(() => setErr('Form unavailable.'));
  }, [adId]);

  if (err && !cfg) return <div className="alert alert-warning">{err}</div>;
  if (!cfg) return <p>Loading…</p>;

  const totalQuestions = cfg.questions.length;
  const contactStep = totalQuestions;
  const website = cfg.website || link || '';

  const set = (k: string, value: string) => setV((s) => ({ ...s, [k]: value }));

  /* the account fills the first two fields, as the mockup shows them already carrying the
     viewer's name and address; state holds only what has actually been typed, so nothing has
     to be written back when the account arrives */
  const accountDefaults: Record<string, string> = {
    name: authUser?.name ?? '',
    email: authUser?.email ?? '',
  };
  const val = (k: string) => v[k] ?? accountDefaults[k] ?? '';

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      await api.post(`/ads/formulary/${adId}/lead`, {
        name: val('name'),
        email: val('email'),
        phone: val('phone'),
        company: val('company'),
        answer1: v.answer1 ?? '',
        answer2: v.answer2 ?? '',
        answer3: v.answer3 ?? '',
        answer4: v.answer4 ?? '',
      });
      setDone(true);
    } catch {
      setErr('Please complete all required fields.');
    } finally {
      setBusy(false);
    }
  }

  /** the advertiser's row, at the top of every step */
  const header = (
    <div className="lead-form-brand">
      {cfg.avatar ? (
        <img className="lead-form-avatar" src={assetImage(cfg.avatar)} alt="" />
      ) : (
        <span className="lead-form-avatar" />
      )}
      <span className="lead-form-company">{cfg.company || cfg.title}</span>
    </div>
  );

  const close = onClose ? (
    <button className="lead-form-close" onClick={onClose} aria-label="Close">
      ✖
    </button>
  ) : null;

  if (done) {
    return (
      <div className="lead-form-overlay" onClick={onClose}>
        <div className="lead-form-box" onClick={(e) => e.stopPropagation()}>
          {close}
          {header}
          <div className="lead-form-success">
            <p>Formulary filled successfully. Your information has been sent to the business publisher.</p>
            <p>They will contact you as soon as possible.</p>
            {website && <p>You can visit the website of the publisher while they contact you.</p>}
          </div>
          {website && (
            <div className="lead-form-actions center">
              <a
                className="lead-form-btn-send"
                href={website}
                target="_blank"
                rel="noopener noreferrer"
              >
                Visit website
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* the creative itself, with the advertiser's own call to action under it */
  if (step === -1) {
    return (
      <div className="lead-form-overlay" onClick={onClose}>
        <div className="lead-form-box" onClick={(e) => e.stopPropagation()}>
          {close}
          {header}
          <div className="lead-form-creative">
            {isVideoFile(media ?? '') ? (
              <video controls loop muted playsInline>
                <source src={assetImage(media!)} type={videoMime(media!)} />
              </video>
            ) : (
              <img src={assetImage(media!)} alt="Advertisement" />
            )}
          </div>
          <div className="lead-form-actions center">
            <button className="lead-form-btn" onClick={() => setStep(0)}>
              {cfg.buttonAction || 'More Info'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step < totalQuestions) {
    const idx = step + 1;
    const isLast = step === totalQuestions - 1;
    const canGoBack = step > 0 || media !== undefined;

    return (
      <div className="lead-form-overlay" onClick={onClose}>
        <div className="lead-form-box" onClick={(e) => e.stopPropagation()}>
          {close}
          {header}

          <p className="lead-form-question">
            Question {idx}: {cfg.questions[step]}
          </p>
          <textarea
            className="lead-form-answer"
            value={v[`answer${idx}`] ?? ''}
            onChange={(e) => set(`answer${idx}`, e.target.value)}
          />

          {err && <div className="lead-form-error">{err}</div>}

          <div className={`lead-form-actions${canGoBack ? '' : ' center'}`}>
            {canGoBack && (
              <button className="lead-form-btn" onClick={() => setStep(step - 1)}>
                Back
              </button>
            )}
            <button
              className="lead-form-btn"
              onClick={() => setStep(isLast ? contactStep : step + 1)}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  const field = (label: string, key: string, type = 'text') => (
    <div className="lead-form-field">
      <label htmlFor={`lead-${key}`}>{label}</label>
      <input
        id={`lead-${key}`}
        type={type}
        value={val(key)}
        onChange={(e) => set(key, e.target.value)}
        required
      />
    </div>
  );

  return (
    <div className="lead-form-overlay" onClick={onClose}>
      <div className="lead-form-box" onClick={(e) => e.stopPropagation()}>
        {close}
        {header}

        {cfg.askName && field('Introduce your name:', 'name')}
        {cfg.askEmail && field('Introduce your email:', 'email', 'email')}
        {cfg.askCompany && field('Introduce your Company Name:', 'company')}
        {cfg.askPhone && field('Introduce your phone number:', 'phone', 'tel')}

        {err && <div className="lead-form-error">{err}</div>}

        <div className="lead-form-actions">
          <button
            className="lead-form-btn"
            onClick={() => setStep(totalQuestions > 0 ? totalQuestions - 1 : -1)}
          >
            Back
          </button>
          <button className="lead-form-btn-send" disabled={busy} onClick={submit}>
            {busy ? 'Sending…' : 'Send info'}
          </button>
        </div>
      </div>
    </div>
  );
}
