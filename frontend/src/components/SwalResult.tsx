/**
 * The app's confirmation dialog — SweetAlert2's shape as the Laravel layout renders it
 * (`layouts_direct_user/main.blade.php:322-347`: purple ground, white text, 1.2rem).
 * SweetAlert2 is not a dependency here, so this stands in for it everywhere.
 *
 * It lived in Profile.tsx until AddPostModal needed it too — and AddPostModal is imported
 * by Profile, which would have made the two files import each other.
 */
/** sweetalert2-default-style result popup (white, icon, OK button). */
export function SwalResult({
  icon,
  title,
  text,
  onClose,
}: {
  icon?: 'success' | 'error';
  title: string;
  text?: string;
  onClose: () => void;
}) {
  return (
    <div
      className="sf-modal-scrim"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
    >
      <div
        className="sf-modal-pop"
        onClick={(e) => e.stopPropagation()}
        style={{
          /* Laravel's global .swal2-modal theme: purple background, white text, 1.2rem. */
          background: '#8a2be2',
          color: '#fff',
          borderRadius: 5,
          width: '32em',
          maxWidth: '90%',
          padding: '2em 1.6em',
          textAlign: 'center',
          /* SweetAlert2 fonts as rendered on the Laravel layout: Roboto body, ~12px base. */
          fontFamily: 'Roboto, Arial, sans-serif',
          fontSize: '12px',
        }}
      >
        {icon && (
          <div
            style={{
              width: 80,
              height: 80,
              margin: '0 auto 1em',
              borderRadius: '50%',
              border: `4px solid ${icon === 'success' ? '#a5dc86' : '#f27474'}`,
              color: icon === 'success' ? '#a5dc86' : '#f27474',
              fontSize: 46,
              lineHeight: '72px',
            }}
          >
            {icon === 'success' ? '✓' : '✕'}
          </div>
        )}
        <h2 style={{ fontFamily: 'Montserrat, Arial, sans-serif', fontSize: '22.5px', fontWeight: 600, margin: '0 0 0.4em', color: '#fff' }}>{title}</h2>
        {text && <div style={{ fontSize: '13.5px', fontWeight: 400, color: '#fff', marginBottom: '1.2em' }}>{text}</div>}
        <button
          type="button"
          onClick={onClose}
          style={{
            /* .swal2-confirm: white button, black text, no radius. */
            /* .swal2-confirm as rendered: 3px radius, Roboto 12px/700, ~7.5px 13.2px pad. */
            background: '#fff',
            color: '#000',
            border: 0,
            borderRadius: '3px',
            fontSize: '12px',
            fontWeight: 700,
            padding: '7.5px 13.2px',
            cursor: 'pointer',
          }}
        >
          OK
        </button>
      </div>
    </div>
  );
}
