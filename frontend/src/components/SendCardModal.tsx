import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { assetImage } from '../utils/format';
import '../styles/send-card-modal.css';

/**
 * "Chat with @name" — the dialog the ✉️ raises, and the one a "Receive More Cards" ad opens.
 *
 * The blade's button carries `data-target="#uchatmodal"`, and that modal is defined nowhere;
 * what actually answers the click is a `Swal.fire` bound to `#chat_with_me_btn` further down
 * the same file (user_profile.blade.php:1461-1494). That is the "personalized modal" the
 * client remembered, and this is it: the creator's picture as the swal icon, the title, one
 * textarea, a Send on the right, and the conversation so far beneath.
 *
 * Everything below is measured off that blade — the 92px round picture with its 4px white
 * ring, the textarea's own inline styles, the green Send, the 600px popup, and the bubbles'
 * orange edges (#E65100 to the left for yours, #FFA500 to the right for theirs). The purple
 * ground is not this dialog's own: `layouts_direct_user/main.blade.php:335` paints every
 * SweetAlert on the page `#8a2be2` with white text at 1.2rem, and this page extends it.
 *
 * It reads and writes through /chatbox, exactly as the blade's fetchMessages/sendMessage do,
 * so a card lands in the same conversation the Messages page shows.
 */

interface ChatRow {
  id: string;
  message: string;
  senderId: string;
  created_at: string;
}

/** the blade's `${day} ${month}`, e.g. "14 August" */
function bladeDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${d.toLocaleString('default', { month: 'long' })}`;
}

export function SendCardModal({
  receiverId,
  usernameUrl,
  name,
  profilePicture,
  onClose,
  onSent,
}: {
  receiverId: string;
  usernameUrl: string | null;
  name?: string | null;
  profilePicture?: string | null;
  onClose: () => void;
  /** the caller may want to know, e.g. to close a tile's own state */
  onSent?: () => void;
}) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ChatRow[]>([]);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /* the note is the only thing to do here, so the cursor starts in it */
  useEffect(() => {
    boxRef.current?.focus();
  }, []);

  /* Escape closes, as swal's own dialogs do */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  /* the blade's didOpen: `await fetchMessages()` before the dialog is usable */
  async function load() {
    try {
      const { data } = await api.post<ChatRow[]>('/chatbox/fetch', { otherId: receiverId });
      setRows(data);
    } catch {
      /* the blade logs and leaves the box empty rather than failing the dialog */
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receiverId]);

  /* `chatbox.scrollTop = chatbox.scrollHeight` — the newest message in view */
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [rows]);

  async function send() {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.post('/chatbox/send', { receiverId, message });
      /* the blade clears the box and re-reads the thread; the sent card shows up in it */
      setText('');
      onSent?.();
      await load();
    } catch (err) {
      const res = (err as { response?: { status?: number; data?: { message?: string } } }).response;
      setError(
        res?.status === 401
          ? 'Please log in to send a message.'
          : res?.data?.message ?? 'The message could not be sent. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  const handle = usernameUrl ?? name ?? '';

  return (
    <div className="swal-scrim" onClick={onClose}>
      <div className="swal-pop send-card-box" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="swal-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        {/* iconHtml: 92px, border-radius 74px, 4px solid white */}
        {profilePicture && (
          <img className="swal-icon-img" src={assetImage(profilePicture)} alt="" />
        )}

        <h2 className="swal-title">Chat with @{handle}</h2>

        <textarea
          ref={boxRef}
          id="chatMessageInput"
          className="send-card-text"
          placeholder="Send your message to your influencer"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError(null);
          }}
        />

        <div style={{ textAlign: 'right' }}>
          <button
            type="button"
            className="send-card-send"
            onClick={() => void send()}
            disabled={busy || text.trim().length === 0}
          >
            {busy ? 'Sending…' : 'Send'}
          </button>
        </div>

        {error && <p className="send-card-error">{error}</p>}

        <br />

        <div className="send-card-chatbox" ref={listRef}>
          {rows.map((m) => {
            const mine = user != null && m.senderId === user.id;
            return (
              <div key={m.id} className={`send-card-bubble${mine ? ' mine' : ''}`}>
                {bladeDate(m.created_at)}
                <br />
                {mine && <br />}
                {/* the blade falls back to SUPERHEROINA.svg for a fan with no picture of
                    their own; the creator always has one */}
                <img
                  className="send-card-bubble-avatar"
                  src={assetImage(
                    (mine ? user?.profilePicture : profilePicture) || 'SUPERHEROINA.svg',
                  )}
                  alt=""
                />{' '}
                {mine ? 'you:' : `@${handle} says: `}
                <br />
                {m.message}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
