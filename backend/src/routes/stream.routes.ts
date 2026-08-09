import { Router } from 'express';
import { AccessToken } from 'livekit-server-sdk';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/errors.js';
import { env } from '../config/env.js';
import { StreamRoom } from '../models/StreamRoom.js';
import { User } from '../models/User.js';

export const streamRouter = Router();

/**
 * Create a stream room — port of StreamController@createRoom. The creator supplies a
 * bio + tags; we mint a unique room name and return it so the client can open the
 * broadcaster page at /start-stream/:room.
 */
streamRouter.post(
  '/create-room',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { bio, tags } = z
      .object({ bio: z.string().min(1).max(255), tags: z.string().min(1).max(255) })
      .parse(req.body);

    const roomName = `room_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    await StreamRoom.create({ roomName, bio, tags, user: req.auth!.userId });
    res.json({ roomName });
  }),
);

/**
 * Broadcaster page data — port of StreamController@startStream. Returns the room's
 * bio/tags plus the owner's name, follower count and avatar so the page can render
 * without fabricating anything.
 */
streamRouter.get(
  '/stream/room/:roomName',
  requireAuth,
  asyncHandler(async (req, res) => {
    const room = await StreamRoom.findOne({ roomName: req.params.roomName });
    if (!room) throw ApiError.notFound('Stream room not found');
    const owner = await User.findById(room.user);
    if (!owner) throw ApiError.notFound('Stream owner not found');

    res.json({
      userId: String(owner._id),
      roomName: room.roomName,
      userName: owner.name ?? 'GuestUser',
      bio: room.bio,
      tags: room.tags,
      followers: owner.noOfFollowers ?? 0,
      profilePicture: owner.profilePicture ?? null,
    });
  }),
);

/**
 * Stream access token — port of StreamController@getStreamToken.
 * Same grants as the Laravel version: join the named room, publish and subscribe,
 * with the caller's name as the participant identity.
 */
streamRouter.get(
  '/streamtoken',
  asyncHandler(async (req, res) => {
    const room = typeof req.query.room === 'string' ? req.query.room : '';
    const user = typeof req.query.user === 'string' ? req.query.user : '';

    if (!room || !user) {
      res.status(400).json({ error: 'Missing parameters' });
      return;
    }
    if (!env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) {
      res.status(503).json({ error: 'Streaming is not configured' });
      return;
    }

    const at = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, { identity: user });
    at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true });

    res.json({ token: await at.toJwt(), room, user, url: env.LIVEKIT_URL });
  }),
);
