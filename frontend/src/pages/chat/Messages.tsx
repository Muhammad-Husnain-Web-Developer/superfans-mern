import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { assetImage, formatPrice } from '../../utils/format';
import { io, type Socket } from 'socket.io-client';
import { api } from '../../api/client';
import { fetchProfile } from '../../api/profiles';
import { usePaymentReturn } from '../../utils/usePaymentReturn';
import { useAuth, type UserPresence } from '../../context/AuthContext';
import { useStandalonePageStyles, BOOTSTRAP4_CDN } from '../../components/StandalonePage';
import { localeLogo } from '../auth/AuthShell';
import { PresenceDot } from '../../components/PresenceDot';
import { onPresenceChange } from '../../utils/presence';

/**
 * Chat — port of influencer/messages.blade.php (a full-screen WhatsApp-style page used
 * by both fans and creators). Left: the people you've chatted with + a Busy/ON toggle
 * for creators. Right: the open conversation (green bubbles for you, white for them) or
 * a placeholder. New messages arrive in real time over Socket.io (the approved upgrade).
 */

interface ChatUser {
  id: string;
  name: string;
  profilePicture: string | null;
  presence: UserPresence;
}
interface Msg {
  id: string;
  message: string;
  senderId: string;
  receiverId: string;
  created_at: string;
}

const CHAT_BG =
  "url('https://web.whatsapp.com/img/bg-chat-tile-light_a4be512e7195b6b733d9110b408f075d.png')";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function Messages() {
  useStandalonePageStyles([BOOTSTRAP4_CDN, '/page-css/messages.css']);
  const { user: authUser } = useAuth();
  const myId = authUser?.id ?? '';
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [selected, setSelected] = useState<ChatUser | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [chatToggle, setChatToggle] = useState(authUser?.chatToggle ?? true);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const chatboxRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const selectedRef = useRef<ChatUser | null>(null);
  const { t: tUi, i18n } = useTranslation('ui');
  selectedRef.current = selected;

  useEffect(() => {
    document.title = 'Superfans | Messages';
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  function loadUsers() {
    api.get<ChatUser[]>('/chatbox/users').then(({ data }) => setUsers(data)).catch(() => setUsers([]));
  }
  useEffect(loadUsers, []);

  /* A fan sent here from a profile's ✉️, from an ad's Send Card, or straight off the $10
     checkout arrives as ?to=<handle>. Open that conversation at once — including one that
     does not exist yet: a creator nobody has written to is not in /chatbox/users, so they
     are looked up by handle and put at the top of the list with an empty thread. */
  useEffect(() => {
    const handle = new URLSearchParams(window.location.search).get('to');
    if (!handle) return;
    void fetchProfile(handle)
      .then((p) => {
        const target: ChatUser = {
          id: p.id,
          name: p.name,
          profilePicture: p.profilePicture,
          presence: p.presence ?? 'online',
        };
        setUsers((prev) => (prev.some((u) => u.id === target.id) ? prev : [target, ...prev]));
        return openChat(target);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* the $10 priority access is reconciled here now, because this is where its checkout
     returns to — the webhook cannot reach a developer's machine */
  const paymentStatus = usePaymentReturn();
  /* It says its piece and goes. The page is a fixed 100vh with the message box at its
     foot, so a bar in the flow pushes that box off the bottom edge — this one floats over
     the top instead, fades at 3.5s and is gone by 4. */
  const [flash, setFlash] = useState<'in' | 'out' | 'gone'>('in');
  useEffect(() => {
    if (!paymentStatus) return;
    const fade = setTimeout(() => setFlash('out'), 3500);
    const drop = setTimeout(() => setFlash('gone'), 4000);
    return () => {
      clearTimeout(fade);
      clearTimeout(drop);
    };
  }, [paymentStatus]);

  // real-time: append messages for the open conversation, and bump the sender to the top
  useEffect(() => {
    // Same-origin connection so the auth cookie rides along; dev proxies /socket.io → API.
    const socket = io({ withCredentials: true });
    socketRef.current = socket;
    socket.on('chat:message', (m: Msg) => {
      const open = selectedRef.current;
      if (open && (m.senderId === open.id || m.receiverId === open.id)) {
        setMessages((prev) => [...prev, m]);
      }
      moveToTop(m.senderId);
    });
    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () =>
      onPresenceChange((userId, presence) => {
        setUsers((prev) =>
          prev.map((user) => (user.id === userId ? { ...user, presence } : user)),
        );
        setSelected((prev) => (prev?.id === userId ? { ...prev, presence } : prev));
      }),
    [],
  );

  useEffect(() => {
    if (chatboxRef.current) chatboxRef.current.scrollTop = chatboxRef.current.scrollHeight;
  }, [messages]);

  function moveToTop(userId: string) {
    setUsers((prev) => {
      const i = prev.findIndex((u) => u.id === userId);
      if (i <= 0) return prev;
      const copy = [...prev];
      const [item] = copy.splice(i, 1);
      copy.unshift(item);
      return copy;
    });
  }

  async function openChat(user: ChatUser) {
    setSelected(user);
    setMobileChatOpen(true);
    const { data } = await api.post<Msg[]>('/chatbox/fetch', { otherId: user.id });
    setMessages(data);
  }

  async function send() {
    const text = draft.trim();
    if (!text || !selected || sending) return;
    setSending(true);
    try {
      const { data } = await api.post<{ data: Msg }>('/chatbox/send', {
        receiverId: selected.id,
        message: text,
      });
      setMessages((prev) => [...prev, data.data]);
      setDraft('');
      moveToTop(selected.id);
    } finally {
      setSending(false);
    }
  }

  function toggleChat(next: boolean) {
    setChatToggle(next);
    void api.patch('/me/settings', { chatToggle: next }).catch(() => setChatToggle(!next));
  }

  return (
    <div id="chat-container" style={{ height: '100vh', width: '100%', margin: 0, overflow: 'hidden' }}>
      {/* one line confirming the priority access just bought, since the fan lands here
          straight off the checkout rather than on a page of its own */}
      {paymentStatus && flash !== 'gone' && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10000,
            padding: '8px 14px',
            background: '#5cb85c',
            color: '#fff',
            fontFamily: 'Consolas, Menlo, Monaco, monospace',
            fontSize: 13,
            textAlign: 'center',
            opacity: flash === 'out' ? 0 : 1,
            transition: 'opacity 0.45s',
            pointerEvents: 'none',
          }}
        >
          {paymentStatus.message}
        </div>
      )}
      <div className="row g-0" style={{ height: '100%', margin: 0 }}>
        {/* left: user list */}
        <div
          className="col-md-4 d-md-block"
          id="userListColumn"
          style={{
            height: '100%',
            display: mobileChatOpen ? 'none' : 'flex',
            flexDirection: 'column',
            borderRight: '1px solid #e9edef',
            background: '#f8f9fa',
          }}
        >
          <div
            style={{
              padding: 15,
              borderBottom: '1px solid #e9edef',
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
              <img
                src={localeLogo(i18n.resolvedLanguage ?? 'en')}
                alt="SuperFans Logo"
                style={{ height: 26.5 }}
              />
            </a>
            {authUser?.role === 'influencer' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="tooltip-container" style={{ fontSize: 18, position: 'relative', bottom: 2.5 }}>
                  ⓘ
                  <span className="tooltip-text">
                    Putting the status in Busy will activate <br /> a premium account at {formatPrice(10)}.
                  </span>
                </span>
                <span style={{ position: 'relative', bottom: 3 }}>{tUi('chat_busy_on')}</span>
                <label className="switch">
                  <input type="checkbox" id="chatToggle" checked={chatToggle} onChange={(e) => toggleChat(e.target.checked)} />
                  <span className="slider round"></span>
                </label>
              </div>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
            <div style={{ padding: '15px 0' }}>
              <h5 style={{ color: '#667781', fontSize: 14, padding: '0 15px 10px 15px', margin: 0, textTransform: 'uppercase' }}>
                ✉️ Cards
              </h5>
              <ul id="userList" className="list-group" style={{ border: 'none', margin: 0 }}>
                {users.map((u) => (
                  <li
                    key={u.id}
                    className="list-group-item"
                    onClick={() => void openChat(u)}
                    style={{
                      border: 'none',
                      borderBottom: '1px solid #e9edef',
                      padding: '12px 15px',
                      margin: 0,
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: selected?.id === u.id ? '#f5f5f5' : '',
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.background = '#f5f5f5')}
                    onMouseOut={(e) => (e.currentTarget.style.background = selected?.id === u.id ? '#f5f5f5' : '')}
                  >
                    <img
                      src={u.profilePicture ? assetImage(u.profilePicture) : '/assets/images/SUPERHEROINA.svg'}
                      alt=""
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        marginRight: 12,
                        flex: 'none',
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, color: '#111' }}>{u.name}</div>
                      <div style={{ fontSize: 12, color: '#667781', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <PresenceDot userId={u.id} presence={u.presence} size={8} />
                        {tUi(`presence_${u.presence}`)}
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: '#667781' }}>2:30 PM</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* right: chat area or placeholder */}
        {selected ? (
          <div
            id="chatArea"
            className="col-md-8"
            style={{ display: mobileChatOpen || true ? 'block' : 'none', height: '100%', position: 'relative', margin: 0 }}
          >
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div
                id="chatHeader"
                style={{ padding: 15, background: '#f0f2f5', borderBottom: '1px solid #e9edef', display: 'flex', alignItems: 'center' }}
              >
                <button
                  id="backButton"
                  className="d-md-none"
                  onClick={() => {
                    setMobileChatOpen(false);
                    setSelected(null);
                  }}
                  style={{ background: 'none', border: 'none', marginRight: 15, padding: 5 }}
                >
                  <h1 style={{ margin: 0 }}>&lt;</h1>
                </button>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 16, display: 'flex', alignItems: 'center' }}>
                      <span id="currentChatUser">{selected.name}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#667781', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <PresenceDot userId={selected.id} presence={selected.presence} size={8} />
                      {tUi(`presence_${selected.presence}`)}
                    </div>
                  </div>
                </div>
              </div>

              <div
                id="chatbox"
                ref={chatboxRef}
                style={{
                  flex: 1,
                  overflowY: 'scroll',
                  overflowX: 'hidden',
                  padding: 15,
                  background: '#e5ddd5',
                  backgroundImage: CHAT_BG,
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                {messages.map((m) => {
                  const mine = m.senderId === myId;
                  const bubble: CSSProperties = {
                    marginBottom: 15,
                    padding: '8px 12px',
                    borderRadius: 8,
                    maxWidth: '80%',
                    wordBreak: 'break-word',
                    boxShadow: '0 1px 0.5px rgba(0,0,0,0.13)',
                    background: mine ? '#DCF8C6' : 'white',
                    marginLeft: mine ? 'auto' : undefined,
                    marginRight: mine ? undefined : 'auto',
                  };
                  return (
                    <div key={m.id} style={bubble}>
                      {m.message}
                      <div style={{ fontSize: 11, color: '#667781', marginTop: 2, textAlign: mine ? 'right' : 'left' }}>
                        {fmtTime(m.created_at)}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="class-footer-m"></div>
              <div
                className="chat-footer"
                style={{ background: '#f0f2f5', padding: 15, borderTop: '1px solid #e9edef', display: 'flex' }}
              >
                <textarea
                  id="chatMessageInput"
                  className="form-control"
                  placeholder={tUi('chat_type_message')}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  style={{ width: '90%', height: 60, resize: 'none', borderRadius: 8, border: 'none', padding: 10, boxShadow: 'none' }}
                />
                <button
                  id="sendMessageButton"
                  className="btn btn-success"
                  onClick={() => void send()}
                  disabled={!draft.trim() || sending}
                  style={{
                    border: '2px solid #409c40',
                    borderRadius: 0,
                    width: 59,
                    height: 59,
                    padding: 0,
                    flex: '0 0 59px',
                    display: 'inline-block',
                    marginLeft: 1,
                  }}
                >
                  ✉️
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="col-md-8 d-flex justify-content-center align-items-center"
            id="placeholderArea"
            style={{ height: '100%', color: '#999', background: '#f8f9fa', margin: 0 }}
          >
            <div style={{ width: '100%', textAlign: 'center', padding: 20, marginTop: '30%' }}>
              ✉️
              <h4 style={{ fontWeight: 300, color: '#555' }}>{tUi('chat_pick_conversation')}</h4>
              <p style={{ color: '#999', fontSize: 14 }}>{tUi('chat_messages_appear')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
