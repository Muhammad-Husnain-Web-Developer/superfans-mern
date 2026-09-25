import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

/**
 * The purple notice the client asked for: shown only on a phone, on any of the
 * Super Ads pages, telling the advertiser this module is built for a computer.
 *
 * The modal is once per browser session — dismissed with the OK button or a tap
 * on the backdrop, it stays down until the tab is closed. Reopening it on every
 * page of the module would read as a fault rather than a warning; refreshing the
 * tab shows it once more, which is the same shape every other notice in the app
 * carries.
 *
 * Uses the app's own `.sf-modal-scrim` / `.sf-modal-pop` classes, so it inherits
 * the entry animation from modal-animations.css and matches SwalResult's box.
 */
const DISMISS_KEY = 'sf_superads_mobile_notice_dismissed';
const MOBILE_MAX_WIDTH = 768;

export function SuperAdsMobileNotice() {
  const { t: tUi } = useTranslation('ui');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    /* not on a desktop screen — the tool is built for it, nothing to warn about */
    if (window.innerWidth > MOBILE_MAX_WIDTH) return;
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === '1') return;
    } catch {
      /* storage denied — show it; there is simply nothing to remember */
    }
    setOpen(true);
  }, []);

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* as above */
    }
    setOpen(false);
  }

  if (!open) return null;

  return createPortal(
    <div
      className="sf-modal-scrim"
      onClick={dismiss}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483646,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(0,0,0,0.55)',
      }}
    >
      <div
        className="sf-modal-pop"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#8a2be2',
          color: '#fff',
          borderRadius: 14,
          width: '100%',
          maxWidth: 380,
          padding: '28px 24px 24px',
          textAlign: 'center',
          fontFamily: 'Roboto, Arial, sans-serif',
        }}
      >
        <div style={{ fontSize: 44, lineHeight: 1, marginBottom: 12 }} aria-hidden="true">
          💻
        </div>
        <h3
          style={{
            fontFamily: 'Montserrat, Arial, sans-serif',
            fontSize: 18,
            fontWeight: 600,
            lineHeight: 1.35,
            margin: '0 0 20px',
            color: '#fff',
          }}
        >
          {tUi('superads_mobile_title', {
            defaultValue: 'Open this tool better on a computer for a better experience',
          })}
        </h3>
        <button
          type="button"
          onClick={dismiss}
          style={{
            display: 'inline-block',
            minWidth: 110,
            padding: '9px 22px',
            border: '3px solid #585858',
            borderRadius: 0,
            background: '#c3c3c3',
            color: '#000',
            font: '900 14px Consolas, Menlo, Monaco, monospace',
            cursor: 'pointer',
          }}
        >
          OK
        </button>
      </div>
    </div>,
    document.body,
  );
}