import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { assetImage } from '../utils/format';
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
/**
 * These lines are printed with {!! !!} in the blade, so the markup inside them is real and
 * has to be rendered, not escaped.
 *
 * The trailing <br><br> on the queue line is dropped: the button row below already carries
 * that gap as a margin, and printing both would double it.
 */
function bladeHtml(value: string) {
  return { __html: value.replace(/(<br\s*\/?>|\s)+$/i, '') };
}

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
  const { t } = useTranslation('content');
  const [step, setStep] = useState<'busy' | 'pay'>('busy');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t: tUi } = useTranslation('ui');

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
        <button type="button" className="swal-close" onClick={onClose} aria-label={tUi('close')}>
          ×
        </button>

        {step === 'busy' ? (
          <>
            {/* iconHtml: the creator's picture, 92px, round, 4px white ring */}
            {profilePicture && (
              <img className="swal-icon-img" src={assetImage(profilePicture)} alt="" />
            )}
            <h2 className="swal-title">
              {usernameUrl ? `@${usernameUrl} ` : ''}
              {t('titlebusy_premium_fan')}
            </h2>
            <div className="premium-text">
              <span dangerouslySetInnerHTML={bladeHtml(t('description_premium_fan'))} />
              {/* the blade separates these with <br><br>; the row carries the gap as a
                  margin instead, so it matches the spacing every other dialog uses */}
              <div className="premium-btn-row">
                <button type="button" className="premium-be-fan" onClick={() => setStep('pay')}>
                  {t('button_premium_fan')}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <h2 className="swal-title">{t('titlepay_premium_fan')}</h2>
            <div className="premium-text">
              {/* the fine print is a <font size="11px"> in the string, which is what
                  .premium-fineprint sets too, so the rendering is unchanged */}
              <span dangerouslySetInnerHTML={bladeHtml(t('descriptionpay_premium_fan'))} />

              {error && <p className="premium-error">{error}</p>}

              <div className="premium-btn-row">
                <button
                  type="button"
                  className="premium-pay"
                  onClick={() => void pay()}
                  disabled={busy}
                >
                  {busy ? tUi('opening') : t('buttonpay_premium_fan')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
