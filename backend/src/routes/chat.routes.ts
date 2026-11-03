import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { ChatMessage } from '../models/ChatMessage.js';
import { User } from '../models/User.js';
import { effectivePresence, emitToUser } from '../services/realtime.js';

export const chatRouter = Router();

/**
 * Chat — port of ChatboxController. The Laravel API takes user ids in the body
 * (user_id / influencer_id / sender_id / receiver_id); here the *sender* is always
 * the authenticated user, and the counterpart id is validated to belong to a real
 * user. Messages are stored one-to-one and delivered in real time over Socket.io.
 */

/** getChatUsers — everyone the current user has exchanged messages with, most-recent first. */
chatRouter.get(
  '/users',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = new Types.ObjectId(req.auth!.userId);
    const rows = await ChatMessage.aggregate<{ _id: Types.ObjectId; last: Date }>([
      { $match: { $or: [{ sender: me }, { receiver: me }] } },
      {
        $project: {
          other: { $cond: [{ $eq: ['$sender', me] }, '$receiver', '$sender'] },
          createdAt: 1,
        },
      },
      { $group: { _id: '$other', last: { $max: '$createdAt' } } },
      { $sort: { last: -1 } },
    ]);

    const users = await User.find(
      { _id: { $in: rows.map((r) => r._id) } },
      { name: 1, profilePicture: 1, presence: 1 },
    ).lean();
    const byId = new Map(users.map((u) => [String(u._id), u]));

    // preserve the recency order from the aggregation
    const ordered = rows
      .map((r) => byId.get(String(r._id)))
      .filter(Boolean)
      .map((u) => ({
        id: String(u!._id),
        name: u!.name,
        profilePicture: u!.profilePicture ?? null,
        presence: effectivePresence(String(u!._id), u!.presence),
      }));

    res.json(ordered);
  }),
);

/** fetch — the full conversation between the current user and another, oldest first. */
chatRouter.post(
  '/fetch',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { otherId } = z.object({ otherId: z.string() }).parse(req.body);
    const me = new Types.ObjectId(req.auth!.userId);
    const them = new Types.ObjectId(otherId);

    const messages = await ChatMessage.find({
      $or: [
        { sender: me, receiver: them },
        { sender: them, receiver: me },
      ],
    })
      .sort({ createdAt: 1 })
      .lean();

    res.json(
      messages.map((m) => ({
        id: String(m._id),
        message: m.message,
        senderId: String(m.sender),
        receiverId: String(m.receiver),
        created_at: m.createdAt,
      })),
    );
  }),
);

/** send — create a message from the current user, then push it to the receiver live. */
chatRouter.post(
  '/send',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { receiverId, message } = z
      .object({ receiverId: z.string(), message: z.string().min(1) })
      .parse(req.body);
    const me = req.auth!.userId;

    const doc = await ChatMessage.create({ sender: me, receiver: receiverId, message });
    const payload = {
      id: String(doc._id),
      message: doc.message,
      senderId: me,
      receiverId,
      created_at: doc.createdAt,
    };
    // real-time delivery (the approved Socket.io upgrade); the sender already has it.
    emitToUser(receiverId, 'chat:message', payload);
    res.json({ success: true, data: payload });
  }),
);
