import { io, type Socket } from 'socket.io-client';
import type { UserPresence } from '../context/AuthContext';

/**
 * ESTADO — the one socket the dots share.
 *
 * Every `<PresenceDot>` on a page wants the same `presence:changed` feed, and a wall can
 * hold dozens of them. One connection is opened for the first listener and dropped again
 * when the last one goes, so a page full of dots costs exactly one socket — and none at
 * all on a page with no dot on it.
 *
 * Deliberately separate from the chat page's socket in Messages.tsx: that one is owned by
 * a component that lives only while the page is open, and the dots outlive it. socket.io
 * multiplexes both over a single transport anyway.
 *
 * A guest gets no socket. The handshake authenticates off the access cookie and fails
 * without one, and a signed-out reader still sees whatever presence the page was served
 * with — it just does not update live.
 */
type Listener = (userId: string, presence: UserPresence) => void;

const listeners = new Set<Listener>();
let socket: Socket | null = null;
/** a signed-in session holding the socket open (see holdPresenceSocket) */
let held = false;

function ensureSocket(): void {
  if (socket) return;
  /* same-origin so the auth cookie rides along; dev proxies /socket.io → the API */
  const s = io({ withCredentials: true });
  socket = s;
  s.on('presence:changed', (p: { userId?: string; presence?: UserPresence }) => {
    if (!p?.userId || !p.presence) return;
    /* a copy: a listener may unsubscribe from inside its own callback */
    for (const fn of [...listeners]) fn(p.userId, p.presence);
  });
  /* The handshake reads the access cookie, which lives 15 minutes. A socket already open
     outlives it, but a reconnect after it — a network blip, a phone waking up — is refused,
     and socket.io does not retry a refusal on its own. Renew the session the way the API
     client does and try once more; with no session left (a guest, a signed-out tab) stop. */
  let renewing = false;
  s.on('connect_error', (err: Error) => {
    if (err.message !== 'unauthenticated' || renewing || !held) return;
    renewing = true;
    fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
      .then((r) => {
        if (r.ok && socket === s) s.connect();
      })
      .catch(() => undefined)
      .finally(() => {
        renewing = false;
      });
  });
}

function dropSocketIfIdle(): void {
  if (listeners.size === 0 && !held && socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Keep the socket open for as long as someone is signed in — not just while a dot is on
 * screen. The server reads an open socket as "this account is here", and its dot turns red
 * a minute after the last one closes (David, 16 Oct 2026: the red dot never came on when a
 * user left). Called by AuthProvider for each signed-in account; the returned release runs
 * when they sign out or another account signs in, and the socket is rebuilt so it never
 * goes on speaking for the previous one.
 */
export function holdPresenceSocket(): () => void {
  held = true;
  /* always a fresh one: a socket opened before sign-in (a guest's dots) was refused and is
     dead, and one from a previous account must not carry on as this one */
  socket?.disconnect();
  socket = null;
  ensureSocket();
  return () => {
    held = false;
    socket?.disconnect();
    socket = null;
    /* dots still on the page keep their live feed, now as whoever is signed in */
    if (listeners.size > 0) ensureSocket();
  };
}

/**
 * Watch every presence change. Returns the unsubscribe, so a caller can hand it straight
 * back from a `useEffect`.
 */
export function onPresenceChange(fn: Listener): () => void {
  listeners.add(fn);
  ensureSocket();
  return () => {
    listeners.delete(fn);
    dropSocketIfIdle();
  };
}
