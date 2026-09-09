import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { assetImage } from '../../utils/format';
import '../../styles/chat-with-modal.css';

interface Msg {
  id: string;
  message: string;
  senderId: string;
  receiverId: string;
  created_at: string;
}

/**
 * The date over each message, as the blade writes it:
 *
 *   `${timestamp.getDate()} ${timestamp.toLocaleString('default', { month: 'long' })}`
 *
 * — the day, a space, and the month's full name in the browser's own language, which is why
 * the client's screenshot reads "16 Abril" on a Spanish machine and "16 April" here.
 */
function bladeDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${d.toLocaleString('default', { month: 'long' })}`;
}

/**
 * "Chat with @name" — the dialog the blade raises from the profile's ✉️ button
 * (user_profile.blade.php:1461-1497).
 *
 * It is a SweetAlert there and a plain dialog here, because SweetAlert2 is not a dependency of
 * this app; what it looks like is not a matter of opinion either way — chat-with-modal.css
 * carries the numbers read off the blade's own dialog running, and the notes there say which
 * came from where.
 *
 * The conversation is the same one the Messages page shows, over the same two endpoints, so a
 * message written here is in the inbox and a message written there shows up here.
 */
export function ChatWithModal({
  influencerId,
  usernameUrl,
  profilePicture,
  viewerId,
  viewerPicture,
  onClose,
}: {
  influencerId: string;
  usernameUrl: string | null;
  profilePicture?: string | null;
  viewerId: string;
  viewerPicture?: string | null;
  onClose: () => void;
}) {
  const { t: tUi } = useTranslation('ui');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  /* showCloseButton: true, and swal closes on Escape */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  /* didOpen: await fetchMessages() */
  useEffect(() => {
    let cancelled = false;
    api
      .post<Msg[]>('/chatbox/fetch', { otherId: influencerId })
      .then(({ data }) => {
        if (!cancelled) setMessages(data);
      })
      .catch(() => {
        if (!cancelled) setError('The conversation could not be loaded.');
      });
    return () => {
      cancelled = true;
    };
  }, [influencerId]);

  /* `chatbox.scrollTop = chatbox.scrollHeight` — the newest line is the one in view */
  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send() {
    const msg = text.trim();
    if (!msg || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.post('/chatbox/send', { receiverId: influencerId, message: msg });
      setText('');
      const { data } = await api.post<Msg[]>('/chatbox/fetch', { otherId: influencerId });
      setMessages(data);
    } catch {
      setError('The message could not be sent. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const handle = usernameUrl ?? '';

  return (
    <div className="chatwith-scrim" onClick={onClose}>
      <div className="chatwith-pop" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="chatwith-close" onClick={onClose} aria-label={tUi('close')}>
          ×
        </button>

        {/* iconHtml: the creator's picture */}
        {profilePicture && (
          <img className="chatwith-icon" src={assetImage(profilePicture)} alt="" />
        )}

        <div className="chatwith-body">
          <textarea
            className="chatwith-input"
            placeholder={tUi('chat_write_to_influencer')}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="chatwith-send-row">
            <button type="button" className="chatwith-send" onClick={() => void send()} disabled={busy}>
              {tUi('chat_send')}
            </button>
          </div>

          {error && <p className="chatwith-error">{error}</p>}

          {/* the dashed rule the client's own screen draws between what you are writing and
              what has already been said */}
          <div className="chatwith-rule" />

          <div className="chatwith-box" ref={boxRef} id="chatbox">
            {messages.map((m) => {
              const mine = m.senderId === viewerId;
              /* The blade builds each line by hand: the date, the small round picture, who is
                 speaking, then the message under it. Mine carries an extra break above it and
                 says plain "you:"; theirs says "@name says:". */
              return (
                <div key={m.id} className={mine ? 'chatwith-msg mine' : 'chatwith-msg theirs'}>
                  <div className="chatwith-sent">Sent {bladeDate(m.created_at)}</div>
                  <div className="chatwith-who">
                    <img
                      className="chatwith-avatar"
                      src={
                        mine
                          ? viewerPicture
                            ? assetImage(viewerPicture)
                            : '/assets/images/SUPERHEROINA.svg'
                          : profilePicture
                            ? assetImage(profilePicture)
                            : '/assets/images/SUPERHEROINA.svg'
                      }
                      alt=""
                    />
                    <span>{mine ? 'you:' : `@${handle} says:`}</span>
                  </div>
                  <div className="chatwith-text">{m.message}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
