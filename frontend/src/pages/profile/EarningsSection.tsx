import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

/**
 * The PAYMENTS block, shared by the creator panel and the normal user's.
 *
 * David drew the same block for both accounts (1 Oct 2026) and then corrected it in both at
 * once — the three-column line, the display face, the locked partnership button and its
 * width. It is written here rather than twice so the next correction lands in one place.
 *
 * What differs between the two is only the wording under the button: a creator's threshold
 * is counted in subscribers, a normal user's in followers. The caller passes that in.
 */

/** The PAYMENTS lines, set in the panel's display face — H3 is the same family, larger. */
export const EARNINGS_TEXT: CSSProperties = {
  color: 'white',
  marginBottom: 0,
  fontFamily: "'Rockwell Nova'",
  fontWeight: 800,
  fontSize: 17,
};

/**
 * One line: what the money is, how much of it there is, and the button that acts on it.
 *
 * Three columns, not two. The figure used to sit at the end of its label, so the amounts
 * landed wherever the label happened to stop and never lined up. Its own right-aligned
 * column puts $0.00 under $0.00 however long the label beside it runs.
 *
 * `marginBottom` rather than bootstrap's `pb-3`: these modals load the local Bootstrap
 * 3.3.5, which has no spacing utilities, so that class did nothing and the two partnership
 * buttons ended up touching.
 */
export function EarningsRow({
  label,
  amount,
  action,
}: {
  label: ReactNode;
  amount: string;
  action?: ReactNode;
}) {
  return (
    <div className="container-fluid" style={{ paddingLeft: 0, marginBottom: 14 }}>
      <div className="row" style={{ display: 'flex', alignItems: 'center' }}>
        <div className="col-xs-4">
          <label style={EARNINGS_TEXT}>{label}</label>
        </div>
        <div className="col-xs-2" style={{ textAlign: 'end' }}>
          {/* block, so the label fills its column and its right edge IS the column's —
              an inline label hugs its text and the amounts stop lining up */}
          <label style={{ ...EARNINGS_TEXT, whiteSpace: 'nowrap', display: 'block' }}>
            {amount}
          </label>
        </div>
        {/* the widest of the three: the partnership button carries three lines of text and
            wraps badly in anything narrower. `earnings-action` is what makes every button
            in the column one width — see styles/footer-modals.css. */}
        <div className="col-xs-6" style={{ textAlign: 'end', paddingRight: 22 }}>
          <div className="earnings-action">{action}</div>
        </div>
      </div>
    </div>
  );
}

/**
 * The locked two-line button beside each earnings line that is not yet earning.
 *
 * `threshold` is the line under the rule, and it is the one thing that differs between the
 * two panels: "265 Subscribers" for a creator, "10K Followers" for a normal user.
 */
export function PartnershipButton({
  threshold,
  onClick,
}: {
  threshold: string;
  onClick: () => void;
}) {
  const { t } = useTranslation('content');
  return (
    <button type="button" className="partnership-btn" onClick={onClick}>
      <span>{t('notavailable10k_title2')}</span>
      <hr style={{ marginTop: 0, marginBottom: 0 }} />
      {threshold}
    </button>
  );
}

/** "Ask Partnership" — port of #askPartnershipOverlay in layouts_influencer/footer.blade.php. */
export function PartnershipModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('content');
  const { user } = useAuth();

  const emailSubject = encodeURIComponent('Partnership for generate incomes Ads in Video');
  const emailBody = encodeURIComponent(
    `Hello,👋 my name is ${user?.name || '......'} and  I request a Partnership for activate the Tool of EARNINGS WITH ADS.`,
  );
  const mailtoLink = `mailto:superfansworldapp@gmail.com?subject=${emailSubject}&body=${emailBody}`;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 999999999,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '90%',
          maxWidth: 380,
          padding: '28px 22px',
          borderRadius: 7,
          textAlign: 'center',
          position: 'relative',
          color: '#fff',
          background: '#8a2be2',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <span
          onClick={onClose}
          style={{ position: 'absolute', top: 12, right: 14, fontSize: 24, cursor: 'pointer', opacity: 0.7 }}
        >
          &times;
        </span>
        <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 18, color: 'white' }}>
          {t('notavailable10k_title')}
        </h3>
        <p style={{ fontSize: 17, lineHeight: 1.5, marginBottom: 14, fontWeight: 600 }}>
          {t('notavailable10k_message')}
        </p>

        {/* OK Button – opens email with pre-filled subject & body */}
        <a
          href={mailtoLink}
          onClick={() => setTimeout(onClose, 300)}
          style={{
            display: 'inline-block',
            marginTop: 18,
            background: 'limegreen',
            color: 'white',
            padding: '10px 40px',
            fontSize: '0.9em',
            fontWeight: 600,
            cursor: 'pointer',
            border: '3px solid green',
            fontFamily:
              'Consolas, Menlo, Monaco, "Lucida Console", "Liberation Mono", "DejaVu Sans Mono", "Courier New", monospace',
            textDecoration: 'none',
            transition: 'background-color 0.5s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'green';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'limegreen';
          }}
        >
          OK
        </a>
      </div>
    </div>
  );
}
