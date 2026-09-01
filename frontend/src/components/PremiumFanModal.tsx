import { useState } from 'react';
import { api } from '../api/client';
import { assetImage } from '../utils/format';
import '../styles/premium-fan-modal.css';

/**
 * "Premium fan" — the two dialogs the blade raises when a creator has their chat switched
 * off and the fan writes anyway (user_profile.blade.php:1310-1345).
 *
 * Step one is `Swal.fire` with the creator's own picture as the icon, the "Super Busy!"
 * title and the queue message; its only button is the yellow BE PREMIUM FAN. Step two is
 * the price: "Priority Access – $10", the explanation, and PAY $10, which in the blade posts
 * amount=10 / payment_type=one_time to Redsys. This app is on Stripe, so the same charge
 * goes through `/payments/premium/:influencerId`.
 *
 * Every word and colour below is the blade's own — the copy from lang/en/content.php:138-149,
 * the yellow #FFEB3B / #e1be24 / #6A1B9A off the button, and the green PAY button's border
 * and monospace face off its own style attribute.
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
    <div className="sf-modal-scrim premium-scrim" onClick={onClose}>
      <div className="sf-modal-pop premium-box" onClick={(e) => e.stopPropagation()}>
        {/* the blade passes showCloseButton: true on the first dialog */}
        <button type="button" className="premium-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        {step === 'busy' ? (
          <>
            {/* iconHtml: the creator's picture, 92px, round, 4px white ring */}
            {profilePicture && (
              <img className="premium-avatar" src={assetImage(profilePicture)} alt="" />
            )}
            <h2 className="premium-title">
              {usernameUrl ? `@${usernameUrl} ` : ''}Super Busy!
            </h2>
            <p className="premium-text">
              🇺🇸 This influencer is responding to a lot of messages right now, you’re in the
              queue.
            </p>
            <button type="button" className="premium-be-fan" onClick={() => setStep('pay')}>
              🎖 BE ️PREMIUM FAN
            </button>
          </>
        ) : (
          <>
            <h2 className="premium-title">🏅 Priority Access – $10</h2>
            <p className="premium-text">
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
            </p>

            {error && <p className="premium-error">{error}</p>}

            <button
              type="button"
              className="premium-pay"
              onClick={() => void pay()}
              disabled={busy}
            >
              {busy ? 'Opening…' : '✨ PAY $10'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
