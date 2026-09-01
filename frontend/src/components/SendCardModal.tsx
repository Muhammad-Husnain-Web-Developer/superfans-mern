import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { assetImage } from '../utils/format';
import '../styles/send-card-modal.css';

/**
 * "Send Card" — writing one message straight to a creator without leaving the page.
 *
 * The blade points its ✉️ at `#uchatmodal`, but that modal is nowhere in the Laravel source:
 * both `resources/` and `public/` hold the two `data-target` references and no definition, and
 * the repository's single commit already had it that way. So the button does nothing there
 * either. The client asked for it to be built in the app's own idiom, which is what this is —
 * the purple dialog the rest of the app uses, the creator at the top, a note, and Send.
 *
 * It writes through the ordinary chat endpoint, so the message lands in the same conversation
 * the Messages page shows and reaches the creator over the socket like any other.
 */
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
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const boxRef = useRef<HTMLTextAreaElement>(null);

  /* the note is the only thing to do here, so the cursor starts in it */
  useEffect(() => {
    boxRef.current?.focus();
  }, []);

  /* Escape closes, as it does on every other dialog in the app */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const MAX = 1000;
  const left = MAX - text.length;

  async function send() {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setError(null);
    try {
      /* the same endpoint the Messages page writes through — mounted at /chatbox */
      await api.post('/chatbox/send', { receiverId, message });
      setSent(true);
      onSent?.();
      /* long enough to read the confirmation, short enough not to be in the way */
      setTimeout(onClose, 1400);
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

  return (
    <div className="sf-modal-scrim send-card-scrim" onClick={onClose}>
      <div className="sf-modal-pop send-card-box" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="send-card-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className="send-card-head">
          {profilePicture ? (
            <img className="send-card-avatar" src={assetImage(profilePicture)} alt="" />
          ) : (
            <span className="send-card-avatar send-card-avatar-blank" />
          )}
          <div className="send-card-who">
            <span className="send-card-title">✉️ Send a card</span>
            {usernameUrl && <span className="send-card-handle">@{usernameUrl}</span>}
            {name && <span className="send-card-name">{name}</span>}
          </div>
        </div>

        {sent ? (
          <p className="send-card-done">
            ✅ Sent — it is in your conversation with{' '}
            {usernameUrl ? `@${usernameUrl}` : 'them'}.
          </p>
        ) : (
          <>
            <textarea
              ref={boxRef}
              className="send-card-text"
              rows={5}
              maxLength={MAX}
              placeholder="Write your message…"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (error) setError(null);
              }}
              /* Ctrl/⌘+Enter sends, which is what a message box is expected to do */
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') void send();
              }}
            />
            <div className="send-card-foot">
              <span className={`send-card-count${left < 50 ? ' low' : ''}`}>{left}</span>
              <span className="send-card-hint">Ctrl + Enter</span>
            </div>

            {error && <p className="send-card-error">{error}</p>}

            <button
              type="button"
              className="send-card-send"
              onClick={() => void send()}
              disabled={busy || text.trim().length === 0}
            >
              {busy ? 'Sending…' : '✉️ Send'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
