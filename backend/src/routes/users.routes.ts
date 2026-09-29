import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/errors.js';
import { User } from '../models/User.js';
import { UserBlock } from '../models/UserBlock.js';
import { sendMail } from '../services/mailer.js';
import { renderEmail } from '../services/emailTemplate.js';
import { env } from '../config/env.js';

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
    /* the blade links these to live.superfanss.app, a domain that no longer
       resolves; the link now points at wherever this deployment lives */
    const target = `${env.CLIENT_ORIGIN.replace(/\/+$/, '')}/${username}`;
    await sendMail(
      ADMIN_REPORT_EMAIL,
      'User Report Notification',
      renderEmail({
        title: 'A user has been reported',
        lines: [
          `<b>User name:</b> ${username}`,
          `<b>Reason:</b> ${reason}`,
        ],
        action: { label: 'Open the profile', url: target },
      }),
    );
    res.json({ success: true });
  }),
);

usersRouter.post(
  '/reports/post',
  asyncHandler(async (req, res) => {
    const { postId, reason } = z
      .object({ postId: z.string().min(1).max(64), reason: z.string().min(1).max(200) })
      .parse(req.body);
    /* the blade links these to live.superfanss.app, a domain that no longer
       resolves; the link now points at wherever this deployment lives */
    const target = `${env.CLIENT_ORIGIN.replace(/\/+$/, '')}/user/post_detail/${postId}`;
    await sendMail(
      ADMIN_REPORT_EMAIL,
      'Post Report Notification',
      renderEmail({
        title: 'A post has been reported',
        lines: [
          `<b>Post ID:</b> ${postId}`,
          `<b>Reason:</b> ${reason}`,
        ],
        action: { label: 'Open the post', url: target },
      }),
    );
    res.json({ success: true });
  }),
);

/* ---------- report a story (the client asked for the post reasons here too) ---------- */

usersRouter.post(
  '/reports/story',
  asyncHandler(async (req, res) => {
    const { storyId, username, reason } = z
      .object({
        storyId: z.string().min(1).max(64),
        username: z.string().min(1).max(200),
        reason: z.string().min(1).max(200),
      })
      .parse(req.body);
    /* a story is only reachable through its author's handle, so that is what the mail links
       to — the story itself may well have expired by the time anyone opens it */
    const target = `${env.CLIENT_ORIGIN.replace(/\/+$/, '')}/stories/${username}`;
    await sendMail(
      ADMIN_REPORT_EMAIL,
      'Story Report Notification',
      renderEmail({
        title: 'A story has been reported',
        lines: [
          `<b>Story ID:</b> ${storyId}`,
          `<b>Author:</b> @${username}`,
          `<b>Reason:</b> ${reason}`,
        ],
        action: { label: 'Open the stories', url: target },
      }),
    );
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
      { usernameUrl: 1, verified: 1, profilePicture: 1 },
    )
      .sort({ verified: -1 })
      .limit(20)
      .lean();

    res.json({
      success: true,
      /* profilePicture rides along so a picker can show a face beside the handle, and id /
         usernameUrl so a caller that has to act on the account — More Tools sends it a
         vinculación solicitude — has something to name it by. `name` stays as it was: the
         handle under that key is what every existing caller reads. */
      data: results.map((u) => ({
        id: String(u._id),
        usernameUrl: u.usernameUrl,
        name: u.usernameUrl,
        verified: u.verified,
        profilePicture: u.profilePicture ?? null,
      })),
    });
  }),
);
