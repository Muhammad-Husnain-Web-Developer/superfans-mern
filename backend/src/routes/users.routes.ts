import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/errors.js';
import { User } from '../models/User.js';
import { UserBlock } from '../models/UserBlock.js';
import { sendMail } from '../services/mailer.js';

export const usersRouter = Router();

const ADMIN_REPORT_EMAIL = 'dmartinherrada@gmail.com';

/* ---------- block / unblock (mirrors BlockUserController) ---------- */

usersRouter.post(
  '/:id/block',
  requireAuth,
  asyncHandler(async (req, res) => {
    const targetId = req.params.id;
    if (targetId === req.auth!.userId) throw ApiError.badRequest('You cannot block yourself.');
    const target = await User.findById(targetId);
    if (!target) throw ApiError.notFound('User not found');

    await UserBlock.updateOne(
      { blocker: req.auth!.userId, blocked: targetId },
      { $setOnInsert: { blocker: req.auth!.userId, blocked: targetId } },
      { upsert: true },
    );
    res.json({ success: true, message: 'User blocked.' });
  }),
);

usersRouter.post(
  '/:id/unblock',
  requireAuth,
  asyncHandler(async (req, res) => {
    await UserBlock.deleteOne({ blocker: req.auth!.userId, blocked: req.params.id });
    res.json({ success: true, message: 'User unblocked.' });
  }),
);

/* ---------- reports (mirrors ReportController — admin notification email) ---------- */

usersRouter.post(
  '/reports/user',
  asyncHandler(async (req, res) => {
    const { username, reason } = z
      .object({ username: z.string().min(1).max(200), reason: z.string().min(1).max(200) })
      .parse(req.body);
    const message = `A user has been reported.\n\nUser Name: ${username}\nReason: ${reason}\nProfile URL: https://live.superfanss.app/${username}`;
    await sendMail(ADMIN_REPORT_EMAIL, 'User Report Notification', `<pre>${message}</pre>`);
    res.json({ success: true });
  }),
);

usersRouter.post(
  '/reports/post',
  asyncHandler(async (req, res) => {
    const { postId, reason } = z
      .object({ postId: z.string().min(1).max(64), reason: z.string().min(1).max(200) })
      .parse(req.body);
    const message = `A post has been reported.\n\nPost ID: ${postId}\nPost URL: https://live.superfanss.app/post/${postId}\nReason: ${reason}`;
    await sendMail(ADMIN_REPORT_EMAIL, 'Post Report Notification', `<pre>${message}</pre>`);
    res.json({ success: true });
  }),
);

/* ---------- all influencers (mirrors UserController@influencers grid) ---------- */

usersRouter.get(
  '/influencers',
  asyncHandler(async (_req, res) => {
    const influencers = await User.find(
      { role: 'influencer' },
      { usernameUrl: 1, name: 1, profilePicture: 1, verified: 1 },
    )
      .sort({ _id: 1 })
      .lean();
    res.json({
      success: true,
      data: influencers.map((u) => ({
        id: String(u._id),
        usernameUrl: u.usernameUrl ?? '',
        name: u.name ?? '',
        profilePicture: u.profilePicture ?? null,
        verified: u.verified,
      })),
    });
  }),
);

/* ---------- influencer search (mirrors autocompleteInfluencerSearch) ---------- */

usersRouter.get(
  '/search/influencers',
  asyncHandler(async (req, res) => {
    const query = String(req.query.query ?? '').trim();
    if (!query) {
      res.json({ success: true, data: [] });
      return;
    }
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const results = await User.find(
      {
        usernameUrl: { $regex: escaped, $options: 'i' },
        role: { $in: ['influencer', 'user'] },
      },
      { usernameUrl: 1, verified: 1 },
    )
      .sort({ verified: -1 })
      .limit(20)
      .lean();

    res.json({
      success: true,
      data: results.map((u) => ({ name: u.usernameUrl, verified: u.verified })),
    });
  }),
);
