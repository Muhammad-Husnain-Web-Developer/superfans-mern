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

function ensureSocket(): void {
  if (socket) return;
  /* same-origin so the auth cookie rides along; dev proxies /socket.io → the API */
  socket = io({ withCredentials: true });
  socket.on('presence:changed', (p: { userId?: string; presence?: UserPresence }) => {
    if (!p?.userId || !p.presence) return;
    /* a copy: a listener may unsubscribe from inside its own callback */
    for (const fn of [...listeners]) fn(p.userId, p.presence);
  });
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
    if (listeners.size === 0 && socket) {
      socket.disconnect();
      socket = null;
    }
  };
}
