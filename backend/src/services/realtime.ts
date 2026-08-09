import type http from 'node:http';
import { Server, type Socket } from 'socket.io';
import { ACCESS_COOKIE, verifyAccessToken } from '../utils/jwt.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

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
  });

  logger.info('Socket.io realtime layer ready');
}

/** Emit an event to every socket a given user has open. */
export function emitToUser(userId: string, event: string, payload: unknown): void {
  io?.to(userId).emit(event, payload);
}
