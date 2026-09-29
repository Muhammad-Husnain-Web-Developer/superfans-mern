import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/errors.js';
import { User } from '../models/User.js';
import { PartnerRequest } from '../models/PartnerRequest.js';

export const partnerRouter = Router();

/**
 * Vinculación Partner — the sending half, which belongs to the business account.
 *
 * The client's brief (28 Sep 2026): "Only Business Accounts can do it. They send a solicitude
 * to Influencers/Users for vinculate accounts." His mock of the screen puts it under Super Ads
 * Center → More Tools, headed "Vinculate a User account", with a search field and
 * a Send Solicitude button.
 *
 * The answering half already lives in notifications.routes.ts: the target sees the request in
 * their panel and accepts or declines it there.
 *
 * What an accepted link then *permits* — the business managing that account's ads and posting
 * to its profile — is deliberately not here. That is a separate piece of work, and a permission
 * granted before anything checks it would be a permission nobody can see.
 */

/** "Máx. 5" — the client corrected his own first figure of 11 on 29 Sep 2026. His later mock
    offers a VIP Business upgrade for more than this, which is not built yet. */
const MAX_LINKS = 5;

/** Only a business account may send these; everyone else is refused the whole area. */
async function businessOnly(userId: string) {
  const me = await User.findById(userId, { role: 1 }).lean();
  if (me?.role !== 'business') {
    throw ApiError.forbidden('Only business accounts can link accounts.');
  }
  return me;
}

interface LinkRow {
  id: string;
  status: string;
  createdAt: Date;
  respondedAt?: Date;
  user: {
    id: string;
    usernameUrl: string | null;
    name: string | null;
    profilePicture: string | null;
    role: string | null;
  };
}

/** The business's own list, and how much of its allowance is spoken for. */
partnerRouter.get(
  '/links',
  requireAuth,
  asyncHandler(async (req, res) => {
    await businessOnly(req.auth!.userId);

    const rows = await PartnerRequest.find({ business: req.auth!.userId })
      .sort({ createdAt: -1 })
      .lean();
    const targets = await User.find(
      { _id: { $in: rows.map((r) => r.target) } },
      { usernameUrl: 1, name: 1, profilePicture: 1, role: 1 },
    ).lean();
    const byId = new Map(targets.map((u) => [String(u._id), u]));

    const links: LinkRow[] = rows.map((r) => {
      const u = byId.get(String(r.target));
      return {
        id: String(r._id),
        status: r.status,
        createdAt: r.createdAt,
        respondedAt: r.respondedAt,
        user: {
          id: String(r.target),
          usernameUrl: u?.usernameUrl ?? null,
          name: u?.name ?? null,
          profilePicture: u?.profilePicture ?? null,
          role: u?.role ?? null,
        },
      };
    });

    /* A pending ask counts against the allowance as much as an accepted one: otherwise a
       hundred could be sent out and the limit would only bite once they started coming back. */
    const used = links.filter((l) => l.status === 'pending' || l.status === 'accepted').length;
    res.json({ success: true, data: { links, used, max: MAX_LINKS } });
  }),
);

/** Send a solicitude. */
partnerRouter.post(
  '/links',
  requireAuth,
  asyncHandler(async (req, res) => {
    await businessOnly(req.auth!.userId);
    const { targetId } = z.object({ targetId: z.string() }).parse(req.body);

    if (!Types.ObjectId.isValid(targetId)) throw ApiError.badRequest('Unknown account.');
    if (targetId === req.auth!.userId) throw ApiError.badRequest('An account cannot link to itself.');

    const target = await User.findById(targetId, { role: 1, usernameUrl: 1, status: 1 }).lean();
    if (!target) throw ApiError.notFound('Account not found');
    /* the client's own wording: "a solicitude to Influencers/Users" — not to another business,
       and not to an account that has been taken down */
    if (target.role !== 'influencer' && target.role !== 'user') {
      throw ApiError.badRequest('Only influencer and user accounts can be linked.');
    }
    if (target.status === 'suspended' || target.status === 'deleted') {
      throw ApiError.badRequest('That account is not available.');
    }

    const existing = await PartnerRequest.findOne({
      business: req.auth!.userId,
      target: targetId,
      status: { $in: ['pending', 'accepted'] },
    }).lean();
    if (existing) {
      throw ApiError.badRequest(
        existing.status === 'accepted'
          ? 'That account is already linked.'
          : 'A request to that account is already waiting.',
      );
    }

    const used = await PartnerRequest.countDocuments({
      business: req.auth!.userId,
      status: { $in: ['pending', 'accepted'] },
    });
    if (used >= MAX_LINKS) {
      throw ApiError.badRequest(`You can link at most ${MAX_LINKS} accounts.`);
    }

    const created = await PartnerRequest.create({ business: req.auth!.userId, target: targetId });
    res.json({ success: true, data: { id: String(created._id), status: created.status } });
  }),
);

/**
 * Withdraw a request, or undo a link.
 *
 * Not in the client's first note — he confirmed it on 29 Sep 2026 ("Gracias por el Botón de
 * desvincularse. Por supuesto sí es necesario"). With only five slots, a mistyped search would
 * otherwise cost one for good, and an account could never be unlinked.
 */
partnerRouter.delete(
  '/links/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    await businessOnly(req.auth!.userId);
    const row = await PartnerRequest.findOne({ _id: req.params.id, business: req.auth!.userId });
    if (!row) throw ApiError.notFound('Request not found');
    await row.deleteOne();
    res.json({ success: true });
  }),
);

/**
 * The other side of the same list: who is managing *me*.
 *
 * The client, 29 Sep 2026, asked whether the linked account can break the link itself — "Yes,
 * they can. In the Super Ads Center. More Tools." So an influencer or user reads their managers
 * here and removes one, without needing the business to do it for them.
 */
partnerRouter.get(
  '/managers',
  requireAuth,
  asyncHandler(async (req, res) => {
    const rows = await PartnerRequest.find({ target: req.auth!.userId, status: 'accepted' })
      .sort({ createdAt: -1 })
      .lean();
    const businesses = await User.find(
      { _id: { $in: rows.map((r) => r.business) } },
      { usernameUrl: 1, name: 1, profilePicture: 1 },
    ).lean();
    const byId = new Map(businesses.map((u) => [String(u._id), u]));

    res.json({
      success: true,
      data: {
        managers: rows.map((r) => {
          const u = byId.get(String(r.business));
          return {
            id: String(r._id),
            since: r.respondedAt ?? r.createdAt,
            business: {
              id: String(r.business),
              usernameUrl: u?.usernameUrl ?? null,
              name: u?.name ?? null,
              profilePicture: u?.profilePicture ?? null,
            },
          };
        }),
      },
    });
  }),
);

/** The linked account ends it from its own side. */
partnerRouter.delete(
  '/managers/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = await PartnerRequest.findOne({ _id: req.params.id, target: req.auth!.userId });
    if (!row) throw ApiError.notFound('Link not found');
    await row.deleteOne();
    res.json({ success: true });
  }),
);
