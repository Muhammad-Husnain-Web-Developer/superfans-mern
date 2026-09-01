import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { assetImage } from '../utils/format';
import '../styles/send-card-modal.css';
import '../styles/premium-fan-modal.css';

/**
 * "Premium fan" — the two SweetAlerts the blade raises when a creator has their chat switched
 * off and a fan writes anyway (user_profile.blade.php:1311-1345).
 *
 * Step one is the creator's own picture as the icon, `@name Super Busy!`, the queue message
 * and one yellow BE PREMIUM FAN. Step two is the price: "Priority Access – $10", the
 * explanation, and PAY $10, which in the blade posts amount=10 / payment_type=one_time to
 * Redsys. This app is on Stripe, so the same charge goes through /payments/premium/:id.
 *
 * Every word and colour is the blade's own — the copy from lang/en/content.php:141-149, the
 * yellow #FFEB3B / #e1be24 / #6A1B9A off the button's style attribute, and the green PAY
 * button's #409c40 border and monospace face off its own. The purple ground and the popup
 * geometry are shared with the chat dialog, both being SweetAlerts on the same page.
 */
export function PremiumFanModal({
  influencerId,
  usernameUrl,
  profilePicture,
  onClose,
}: {
  influencerId: string;
  usernameUrl: string | null;
  profilePicture?: string | null;
  onClose: () => void;
}) {
  const [step, setStep] = useState<'busy' | 'pay'>('busy');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* both dialogs pass showCloseButton: true, and swal closes on Escape */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function pay() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post<{ url?: string }>(`/payments/premium/${influencerId}`);
      if (data.url) window.location.href = data.url;
      else {
        setError('The payment page could not be opened. Please try again.');
        setBusy(false);
      }
    } catch (err) {
      const res = (err as { response?: { data?: { message?: string } } }).response;
      setError(res?.data?.message ?? 'Something went wrong. Please try again.');
      setBusy(false);
    }
  }

  return (
    <div className="swal-scrim" onClick={onClose}>
      <div className="swal-pop premium-box" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="swal-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        {step === 'busy' ? (
          <>
            {/* iconHtml: the creator's picture, 92px, round, 4px white ring */}
            {profilePicture && (
              <img className="swal-icon-img" src={assetImage(profilePicture)} alt="" />
            )}
            <h2 className="swal-title">
              {usernameUrl ? `@${usernameUrl} ` : ''}Super Busy!
            </h2>
            <div className="premium-text">
              🇺🇸 This influencer is responding to a lot of messages right now, you’re in the
              queue.
              <br />
              <br />
              <button type="button" className="premium-be-fan" onClick={() => setStep('pay')}>
                🎖 BE ️PREMIUM FAN
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="swal-title">🏅 Priority Access – $10</h2>
            <div className="premium-text">
              Want to skip the queue and get a faster reply?
              <br />
              <br />
              <strong>This one-time $10 payment</strong> gives you priority access.
              <br />
              <br />
              <span className="premium-fineprint">
                This premium subscription won’t be renewed next month, don’t worry! It’s only
                for 1 use.
              </span>

              {error && <p className="premium-error">{error}</p>}

              <div className="premium-pay-row">
                <button
                  type="button"
                  className="premium-pay"
                  onClick={() => void pay()}
                  disabled={busy}
                >
                  {busy ? 'Opening…' : '✨ PAY $10'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
