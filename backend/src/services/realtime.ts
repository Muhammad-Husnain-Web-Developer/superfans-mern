import type http from 'node:http';
import { Server, type Socket } from 'socket.io';
import { ACCESS_COOKIE, verifyAccessToken } from '../utils/jwt.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { User, type UserPresence } from '../models/User.js';

let io: Server | null = null;

/**
 * Socket.io real-time layer (the approved chat upgrade). Each authenticated socket
 * joins a room named after its user id; `emitToUser` pushes an event to that room, so
 * a message reaches every tab the recipient has open — instantly, no polling.
 */
export function initRealtime(server: http.Server): void {
  io = new Server(server, {
    cors: { origin: env.CLIENT_ORIGIN, credentials: true },
  });

  io.use((socket, next) => {
    try {
      const header = socket.handshake.headers.cookie ?? '';
      const token = Object.fromEntries(
        header.split(';').map((c) => {
          const i = c.indexOf('=');
          return [c.slice(0, i).trim(), decodeURIComponent(c.slice(i + 1))];
        }),
      )[ACCESS_COOKIE];
      if (!token) return next(new Error('unauthenticated'));
      const payload = verifyAccessToken(token);
      (socket.data as { userId: string }).userId = payload.sub;
      next();
    } catch {
      next(new Error('unauthenticated'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = (socket.data as { userId: string }).userId;
    void socket.join(userId);
    logger.debug({ userId }, 'socket connected');

    /* ESTADO follows the real connection — see `effectivePresence` below */
    const wasConnected = isConnected(userId);
    const pending = goingOffline.get(userId);
    if (pending) {
      clearTimeout(pending);
      goingOffline.delete(userId);
    }
    openSockets.set(userId, (openSockets.get(userId) ?? 0) + 1);
    if (!wasConnected) void announcePresence(userId);

    socket.on('disconnect', () => {
      const left = (openSockets.get(userId) ?? 1) - 1;
      if (left > 0) {
        openSockets.set(userId, left);
        return;
      }
      openSockets.delete(userId);
      /* the last tab is gone — but a reload or a hop to another page closes the socket and
         opens a new one a moment later, so the dot only turns red if nobody is back in time */
      goingOffline.set(
        userId,
        setTimeout(() => {
          goingOffline.delete(userId);
          if (!isConnected(userId)) void announcePresence(userId);
        }, OFFLINE_GRACE_MS),
      );
    });
  });

  logger.info('Socket.io realtime layer ready');
}

/* ------------------------------------------------------------------ ESTADO ---- *
 * David, 16 Oct 2026: "when a user is disconnected, I think is not working the Red
 * circle". The dot was only ever the reader's own choice, reset to online by a login and to
 * disconnected by the Logout button — closing the browser or the app changed nothing, so
 * nearly every account read green for good. It now follows the connection: every signed-in
 * page holds a socket (utils/presence.ts on the client), and when an account's last one has
 * been gone for a minute its dot turns red, live, and green again when it is back.
 *
 * The reader's own choice still wins: "Ausente" stays yellow and "Desconectado" stays red
 * whether or not they are here. Only "online" depends on being connected.
 *
 * Kept in this process's memory, which holds because the API runs as one pm2 instance
 * (ecosystem.config.cjs: instances 1, fork). After a restart the map starts empty and fills
 * again as clients reconnect, which socket.io does on its own within seconds.
 */

/** how long an account may be without a socket before its dot turns red */
const OFFLINE_GRACE_MS = 60_000;
/** open sockets per account — one per tab, plus the chat page's own */
const openSockets = new Map<string, number>();
/** accounts whose last socket closed, waiting out the grace period */
const goingOffline = new Map<string, NodeJS.Timeout>();

/** Has this account a page open (or closed one less than a minute ago)? */
export function isConnected(userId: string): boolean {
  return (openSockets.get(userId) ?? 0) > 0 || goingOffline.has(userId);
}

/**
 * The dot other people see: the reader's choice, except that "online" reads as
 * disconnected while they have no page open.
 */
export function effectivePresence(userId: string, chosen: UserPresence | null | undefined): UserPresence {
  const presence = chosen ?? 'online';
  return presence === 'online' && !isConnected(userId) ? 'disconnected' : presence;
}

/** Tell every open page what this account's dot now is — only when the connection decides it. */
async function announcePresence(userId: string): Promise<void> {
  try {
    const user = await User.findById(userId, { presence: 1 }).lean();
    if (!user) return;
    const chosen = user.presence ?? 'online';
    /* away / disconnected are the reader's own choice and did not change */
    if (chosen !== 'online') return;
    broadcast('presence:changed', { userId, presence: effectivePresence(userId, chosen) });
  } catch (err) {
    logger.warn({ err, userId }, 'presence announce failed');
  }
}

/** Emit an event to every socket a given user has open. */
export function emitToUser(userId: string, event: string, payload: unknown): void {
  io?.to(userId).emit(event, payload);
}

/**
 * Emit to every connected socket, whoever they are.
 *
 * Chat is addressed — a message concerns two people — but ESTADO is not: anyone with
 * a profile, a wall or a feed open may be looking at the dot of the account that just
 * changed it, and we have no list of who that is. The payload carries only a user id
 * and the new presence, which is already public on every page that renders the dot,
 * so there is nothing here a reader could not have fetched anyway.
 */
export function broadcast(event: string, payload: unknown): void {
  io?.emit(event, payload);
}
