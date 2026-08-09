import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { assetImage } from '../../utils/format';

/**
 * Subscribe confirmation modal — port of #paymentModalCenter (user_profile.blade.php L1071).
 * Purple dialog with the superman icon + "✨ Subscribe to @username:", the "Relax! …single-use"
 * message, a card-safety line, a Terms checkbox and the green ✨Subscribe button. Confirming
 * (with terms checked) starts the payment redirect.
 */
export function SubscribeModal({
  usernameUrl,
  open,
  busy = false,
  onClose,
  onConfirm,
}: {
  usernameUrl: string;
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation('content');
  const [agreed, setAgreed] = useState(false);

  if (!open) return null;

  // The blade string uses Laravel's :link placeholder (i18next only interpolates {{...}}),
  // so substitute it manually with the Terms & Conditions anchor.
  const termsLabel = t('terms', { defaultValue: 'I agree to the :link' }).replace(
    ':link',
    `<a href="https://superfans.world/terminosdeuso" target="_blank" style="color:purple;">${t('terms_link', { defaultValue: 'Terms and Conditions' })}</a>`,
  );

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.5)',
        zIndex: 123122,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          /* Bootstrap modal-dialog-centered: 600px wide, content sizes naturally
             (overflow visible — no inner scrollbar). */
          borderRadius: 20,
          background: '#8a2be2',
          color: '#fff',
          width: 600,
          maxWidth: 'calc(100% - 20px)',
          position: 'relative',
          padding: '0 16px 20px',
        }}
      >
        {/* header */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{ position: 'absolute', right: 10, top: 6, background: 'none', border: 0, fontSize: 45, color: '#fff', lineHeight: 1, cursor: 'pointer' }}
        >
          ×
        </button>
        {/* icon + title inline on one row (blade: inline-block img + h5), left-aligned title */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '24px 42px 0 6px' }}>
          <img src={assetImage('superman2.png')} style={{ height: 51, flexShrink: 0 }} alt="" />
          <h5 style={{ fontSize: 30, color: '#fff', margin: 0, fontWeight: 700, lineHeight: 1.15, textAlign: 'left' }}>
            {t('subscribe_to', { defaultValue: '✨ Subscribe to' })} <span>@</span>
            {usernameUrl}:
          </h5>
        </div>

        {/* body */}
        <div style={{ maxWidth: 360, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ margin: '20px 0' }}>
            <p style={{ margin: 0, fontSize: '1.1em' }}>{t('secondary_message')}</p>
          </div>
          <div style={{ margin: '20px 0' }}>
            <p style={{ margin: 0, fontSize: '0.9em' }}>
              <img src={assetImage('credit_card.png')} alt="" style={{ width: 50, verticalAlign: 'middle', marginRight: 6 }} />
              {t('card_safety')}
            </p>
          </div>
          <div style={{ margin: '15px 0', textAlign: 'center' }}>
            <label style={{ color: '#fff', fontSize: '0.96em', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                style={{ marginRight: 6, verticalAlign: 'middle' }}
              />
              <span dangerouslySetInnerHTML={{ __html: termsLabel }} />
            </label>
          </div>
          <center>
            <button
              type="button"
              className="btn btn-success"
              disabled={!agreed || busy}
              onClick={() => agreed && !busy && onConfirm()}
              style={{ border: '2px solid #409c40', display: 'inline-block', marginLeft: 10, opacity: agreed && !busy ? 1 : 0.6, cursor: agreed && !busy ? 'pointer' : 'not-allowed' }}
            >
              ✨{t('subscribe', { defaultValue: 'Subscribe' })}
            </button>
          </center>
          <br />
          <p style={{ fontSize: '0.74em' }}>{t('welcome_notice')}</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
