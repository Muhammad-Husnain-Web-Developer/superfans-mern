import { useEffect, useState } from 'react';
import { api } from '../../api/client';

interface FormConfig {
  adId: string;
  title: string;
  askName: boolean;
  askEmail: boolean;
  askPhone: boolean;
  askCompany: boolean;
  questions: string[];
  buttonAction: string;
}

/**
 * Public lead-capture form for a clients-form ad — port of the multi-step formulary
 * rendered in the World feed (submitLead()). Loads the form config for `adId`, walks the
 * viewer through contact fields then questions, and POSTs to /ads/formulary/:adId/lead.
 */
export function AdLeadForm({ adId, onClose }: { adId: string; onClose?: () => void }) {
  const [cfg, setCfg] = useState<FormConfig | null>(null);
  const [step, setStep] = useState(0);
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

  if (err) return <div className="alert alert-warning">{err}</div>;
  if (!cfg) return <p>Loading…</p>;

  // steps: [contact] then question pages (2 per page)
  const questionPages: string[][] = [];
  for (let i = 0; i < cfg.questions.length; i += 2) questionPages.push(cfg.questions.slice(i, i + 2));
  const totalSteps = 1 + questionPages.length;
  const set = (k: string, val: string) => setV((s) => ({ ...s, [k]: val }));

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const body: Record<string, string> = {
        name: v.name ?? '',
        email: v.email ?? '',
        phone: v.phone ?? '',
        company: v.company ?? '',
        answer1: v.answer1 ?? '',
        answer2: v.answer2 ?? '',
        answer3: v.answer3 ?? '',
        answer4: v.answer4 ?? '',
      };
      await api.post(`/ads/formulary/${adId}/lead`, body);
      setDone(true);
    } catch {
      setErr('Please complete all required fields.');
    } finally {
      setBusy(false);
    }
  }

  const box: React.CSSProperties = { background: '#8a2be2', color: '#fff', borderRadius: 14, padding: 24, maxWidth: 460, margin: '0 auto', textAlign: 'center' };
  const input: React.CSSProperties = { width: '100%', padding: 10, borderRadius: 8, border: 'none', marginTop: 6, color: '#000' };

  if (done) {
    return (
      <div style={box}>
        <h4>✔ Thank you!</h4>
        <p>Your information has been submitted.</p>
        {onClose && <button className="continue-btn" onClick={onClose}>Close</button>}
      </div>
    );
  }

  return (
    <div style={box}>
      {cfg.title && <h4 className="mb-3">{cfg.title}</h4>}

      {step === 0 && (
        <div>
          {cfg.askName && <div className="mb-2 text-left"><label>Name</label><input style={input} value={v.name ?? ''} onChange={(e) => set('name', e.target.value)} /></div>}
          {cfg.askEmail && <div className="mb-2 text-left"><label>Email</label><input type="email" style={input} value={v.email ?? ''} onChange={(e) => set('email', e.target.value)} /></div>}
          {cfg.askPhone && <div className="mb-2 text-left"><label>Phone</label><input style={input} value={v.phone ?? ''} onChange={(e) => set('phone', e.target.value)} /></div>}
          {cfg.askCompany && <div className="mb-2 text-left"><label>Company</label><input style={input} value={v.company ?? ''} onChange={(e) => set('company', e.target.value)} /></div>}
        </div>
      )}

      {step > 0 && questionPages[step - 1] && (
        <div>
          <h5 className="mb-3">Questions</h5>
          {questionPages[step - 1].map((q) => {
            const idx = cfg.questions.indexOf(q) + 1;
            return (
              <div className="mb-2 text-left" key={q}>
                <label>{q}</label>
                <textarea style={input} value={v[`answer${idx}`] ?? ''} onChange={(e) => set(`answer${idx}`, e.target.value)} required />
              </div>
            );
          })}
        </div>
      )}

      {err && <p style={{ color: '#ffd0d0' }}>{err}</p>}

      <div className="d-flex justify-content-between mt-3" style={{ gap: 10 }}>
        {step > 0 ? (
          <button className="btn btn-light" onClick={() => setStep((s) => s - 1)}>← Back</button>
        ) : onClose ? (
          <button className="btn btn-light" onClick={onClose}>Cancel</button>
        ) : <span />}

        {step < totalSteps - 1 ? (
          <button className="continue-btn" style={{ width: 'auto' as unknown as number, margin: 0 }} onClick={() => setStep((s) => s + 1)}>Continue ➜</button>
        ) : (
          <button className="continue-btn" style={{ width: 'auto' as unknown as number, margin: 0 }} disabled={busy} onClick={submit}>Submit ✔</button>
        )}
      </div>
    </div>
  );
}
