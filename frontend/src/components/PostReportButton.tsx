import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { assetImage } from '../utils/format';

/** The five report reasons from the Laravel post-report dropdown (feed / post_detail). */
const REPORT_REASONS = ['Excessive sensuality', 'Impersonation', 'Violence', 'Racism', 'Other'];

/**
 * Per-post report control — the arrow button that reveals a reasons dropdown and POSTs to
 * /users/reports/post (mirrors submitReport() in feed.blade / post_detail.blade). Fully
 * self-contained so it can drop into any post; the parent may pass onReported to show its
 * own confirmation, otherwise a minimal alert is shown.
 *
 * variant "overlay" (default) is the feed/wall/grid style: an absolute button in the post's
 * bottom-right corner, hidden until the surrounding `.image-hover-wrapper` is hovered (the
 * existing CSS in posts-page.css / profile-page.css drives the reveal). variant "inline"
 * renders a plain always-visible button for headers.
 */
export function PostReportButton({
  postId,
  onReported,
  variant = 'overlay',
  label,
}: {
  postId: string;
  onReported?: () => void;
  variant?: 'overlay' | 'inline';
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);

  function submit(reason: string) {
    setOpen(false);
    api
      .post('/users/reports/post', { postId, reason })
      .then(() => {
        if (onReported) onReported();
        else window.alert('Your report has been successfully submitted. Thanks for making this social network better.');
      })
      .catch(() => {});
  }

  const isOverlay = variant === 'overlay';

  const wrapStyle: React.CSSProperties = isOverlay
    ? { position: 'absolute', bottom: 20, right: 20, zIndex: 10 }
    : { position: 'relative', display: 'inline-block' };

  // Overlay: hidden until the .image-hover-wrapper is hovered (CSS reveals .report-button).
  const buttonStyle: React.CSSProperties = isOverlay
    ? {
        display: 'none',
        background: 'rgba(0,0,0,0.6)',
        color: 'white',
        border: 'none',
        padding: '6px 10px',
        borderRadius: 5,
        fontSize: '0.9rem',
        cursor: 'pointer',
      }
    : { background: 'transparent', border: 0, cursor: 'pointer' };

  return (
    <span ref={wrapRef} style={wrapStyle}>
      <button
        className={isOverlay ? 'report-button report-mobile' : 'report-button-inline report-mobile'}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        style={buttonStyle}
        title="Report"
      >
        <img
          src={assetImage('arrowDown_.png')}
          alt="▼"
          style={{ width: 12, height: 12, position: 'relative', bottom: 1, right: 2, display: 'inline-block' }}
        />
        {label ? ` ${label}` : null}
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            bottom: isOverlay ? '100%' : undefined,
            top: isOverlay ? undefined : '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10000,
            marginBottom: isOverlay ? 6 : undefined,
          }}
        >
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              background: '#fff',
              border: '1px solid #ccc',
              borderRadius: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              overflow: 'hidden',
              width: 170,
              fontSize: 11,
            }}
          >
            {REPORT_REASONS.map((reason) => (
              <li key={reason} style={{ borderBottom: '1px solid #eee' }}>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    submit(reason);
                  }}
                  style={{ display: 'block', padding: '10px 15px', textDecoration: 'none', color: '#333' }}
                >
                  {reason}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </span>
  );
}
