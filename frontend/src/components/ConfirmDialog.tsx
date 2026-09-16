import '../styles/confirm-dialog.css';

/**
 * The classic-SweetAlert `dangerMode` confirm the influencer layout's trash icon raises —
 * `layouts_influencer/footer.blade.php`'s global `.delete` click handler, `type="post"`
 * branch: `swal({ title: 'Are you sure?', text: "You won't be able to revert this!",
 * buttons: { defeat: 'Yes, delete it!', cancel: 'Cancel' }, dangerMode: true })`.
 *
 * That library (unpkg "sweetalert", not SweetAlert2) is not a dependency here either, so —
 * same reasoning as SwalResult — this stands in for it: same purple/white shell, plus the
 * two-button row `dangerMode` adds. The MERN post list deleted immediately on the bin icon
 * with no confirmation at all; the client caught it missing this dialog first.
 */
export function ConfirmDialog({
  title,
  text,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  busy,
}: {
  title: string;
  text?: string;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  return (
    <div
      className="sf-modal-scrim"
      /* this dialog is raised from inside AddPostModal's own scrim (also onClick-to-close),
         so the click has to stop here or it closes that one too */
      onClick={(e) => {
        e.stopPropagation();
        onCancel();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        /* above AddPostModal's own 123122 — this confirms a delete raised from inside it */
        zIndex: 123123,
      }}
    >
      <div
        className="sf-modal-pop"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#8a2be2',
          color: '#fff',
          borderRadius: 5,
          width: '32em',
          maxWidth: '90%',
          padding: '2em 1.6em',
          textAlign: 'center',
          fontFamily: 'Roboto, Arial, sans-serif',
          fontSize: '12px',
        }}
      >
        <h2 style={{ fontFamily: 'Montserrat, Arial, sans-serif', fontSize: '22.5px', fontWeight: 600, margin: '0 0 0.4em', color: '#fff' }}>
          {title}
        </h2>
        {text && <div style={{ fontSize: '13.5px', fontWeight: 400, color: '#fff', marginBottom: '1.2em' }}>{text}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            type="button"
            className="confirm-dialog-btn confirm-dialog-confirm"
            onClick={onConfirm}
            disabled={busy}
            style={{ cursor: busy ? 'wait' : 'pointer' }}
          >
            {confirmText}
          </button>
          <button
            type="button"
            className="confirm-dialog-btn confirm-dialog-cancel"
            onClick={onCancel}
            disabled={busy}
            style={{ cursor: busy ? 'wait' : 'pointer' }}
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}
