import { Router } from 'express';
import { Types } from 'mongoose';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/errors.js';
import { User } from '../models/User.js';
import { Post } from '../models/Post.js';
import { Like } from '../models/Like.js';
import { Followership } from '../models/Followership.js';
import { Subscription } from '../models/Subscription.js';
import { ChatMessage } from '../models/ChatMessage.js';
import { PartnerRequest } from '../models/PartnerRequest.js';
import { Ad } from '../models/Ad.js';

export const notificationsRouter = Router();

/**
 * The notification panel.
 *
 * Nothing here is written when the event happens: the rows are read back out of records that
 * already exist — likes, followerships, subscriptions, chat messages — and assembled per
 * request. That is deliberate. A table written on each event would have started empty, so a
 * creator with years of activity would have opened the panel to nothing, and every count would
 * depend on the writer never missing a path. Read this way the panel is right from the first
 * deploy and cannot drift from what actually happened.
 *
 * The client's shape (28 Sep 2026): announcements pinned first, partner requests second, then
 * everything else by date. The date grouping itself — Hoy / Ayer / Ultimos 7 dias / Este mes /
 * Anteriores — belongs to the reader's own clock, so rows carry their timestamp and the page
 * does the bucketing.
 *
 * One wording note: the client asks for "@username sent you a card", but a card and an ordinary
 * message are the same thing in this app — the green envelope opens ChatWithModal, which posts
 * to /chatbox/send like any other message, and ChatMessage has no flag to tell them apart. Every
 * message received therefore reads as a card here.
 */

/** How many merged rows one page of the panel carries. */
const PAGE = 50;

const VIDEO_EXT = new Set(['mp4', 'mov', 'webm', 'ogg', 'm4v', 'avi', 'mkv', '3gp']);

/** picture or video — the client's wording changes with it ("liked your picture/video"). */
function mediaKind(file?: string | null): 'picture' | 'video' {
  const ext = (file ?? '').split('.').pop()?.toLowerCase() ?? '';
  return VIDEO_EXT.has(ext) ? 'video' : 'picture';
}

interface Actor {
  id: string;
  usernameUrl: string | null;
  /* a business is known by its brand, not a handle — the client's own mock names the
     requester "Adidas". Carried for everyone; only the partner row reads it. */
  name: string | null;
  profilePicture: string | null;
}

type Row =
  | {
      kind: 'like';
      id: string;
      at: Date;
      postId: string;
      media: 'picture' | 'video';
      thumb: string | null;
      actors: Actor[];
      others: number;
    }
  | { kind: 'follow' | 'subscribe' | 'card'; id: string; at: Date; actor: Actor };

notificationsRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = new Types.ObjectId(req.auth!.userId);
    /* the cursor: "older than this". Absent on the first page. */
    const beforeRaw = req.query.before ? new Date(String(req.query.before)) : null;
    const before = beforeRaw && !Number.isNaN(beforeRaw.getTime()) ? beforeRaw : null;
    const olderThan = before ? { createdAt: { $lt: before } } : {};

    const myPosts = await Post.find({ influencer: me }, { _id: 1, imageVideo: 1, thumbnail: 1 })
      .setOptions({ withMissing: true })
      .lean();
    const mediaOf = new Map(myPosts.map((p) => [String(p._id), mediaKind(p.imageVideo)]));
    /* the square preview the client draws on the right of a row: a video's poster frame where
       there is one, the file itself otherwise */
    const thumbOf = new Map(
      myPosts.map((p) => [
        String(p._id),
        p.thumbnail ? `thumbnails/${p.thumbnail}` : (p.imageVideo ?? null),
      ]),
    );
    const myPostIds = myPosts.map((p) => p._id);

    /* Each source is read at the page size: after merging only the newest PAGE survive, so
       nothing past the cut can matter however it was distributed between them. */
    const [likes, follows, subs, cards, partner, activeAd, viewer] = await Promise.all([
      myPostIds.length
        ? Like.find({ post: { $in: myPostIds }, user: { $ne: me }, ...olderThan })
            .sort({ createdAt: -1 })
            /* several likes may collapse into one row per post, so this reads deeper */
            .limit(PAGE * 4)
            .lean()
        : Promise.resolve([]),
      Followership.find({ followedUser: me, followerUser: { $ne: me }, ...olderThan })
        .sort({ createdAt: -1 })
        .limit(PAGE)
        .lean(),
      Subscription.find({ influencer: me, user: { $ne: me }, ...olderThan })
        .sort({ createdAt: -1 })
        .limit(PAGE)
        .lean(),
      ChatMessage.find({ receiver: me, sender: { $ne: me }, ...olderThan })
        .sort({ createdAt: -1 })
        .limit(PAGE)
        .lean(),
      /* Pending only, and never paged: the client pins these above the dated groups, so they
         are not part of the scroll at all. */
      before
        ? Promise.resolve([])
        : PartnerRequest.find({ target: me, status: 'pending' }).sort({ createdAt: -1 }).lean(),
      before
        ? Promise.resolve(null)
        : Ad.findOne({ user: me, status: true }).sort({ createdAt: -1 }).lean(),
      before ? Promise.resolve(null) : User.findById(me, { notificationsSeenAt: 1 }).lean(),
    ]);

    /* one lookup for every account named anywhere on this page */
    const actorIds = new Set<string>();
    for (const l of likes) actorIds.add(String(l.user));
    for (const f of follows) actorIds.add(String(f.followerUser));
    for (const s of subs) actorIds.add(String(s.user));
    for (const c of cards) actorIds.add(String(c.sender));
    for (const p of partner) actorIds.add(String(p.business));

    const actorRows = await User.find(
      { _id: { $in: [...actorIds].map((id) => new Types.ObjectId(id)) } },
      { usernameUrl: 1, name: 1, profilePicture: 1 },
    ).lean();
    const actorOf = new Map<string, Actor>(
      actorRows.map((u) => [
        String(u._id),
        {
          id: String(u._id),
          usernameUrl: u.usernameUrl ?? null,
          name: u.name ?? null,
          profilePicture: u.profilePicture ?? null,
        },
      ]),
    );
    const actor = (id: unknown): Actor =>
      actorOf.get(String(id)) ?? { id: String(id), usernameUrl: null, name: null, profilePicture: null };

    /* "Can be Grouped, in case of same post" — every like on one post is a single row, named
       after the three most recent likers with the rest counted behind them, and stamped with
       the newest of them so it sorts where the latest like belongs. */
    const byPost = new Map<string, { at: Date; actors: Actor[]; others: number }>();
    for (const l of likes) {
      const key = String(l.post);
      const group = byPost.get(key);
      if (!group) {
        byPost.set(key, { at: l.createdAt, actors: [actor(l.user)], others: 0 });
      } else if (group.actors.length < 3) {
        group.actors.push(actor(l.user));
      } else {
        group.others += 1;
      }
    }

    /* One row per sender per day, not one per message. A card and a message are the same
       thing here, so a five-line conversation arrived as five identical "sent you a card"
       rows — which is what it looked like on the first run. Collapsing by sender and day
       keeps the client's singular wording, and still leaves a separate row when the same
       person writes again on another day, so the date groups stay honest. */
    const byCard = new Map<string, { at: Date; actor: Actor }>();
    for (const c of cards) {
      const key = `${String(c.sender)}_${c.createdAt.toISOString().slice(0, 10)}`;
      if (!byCard.has(key)) byCard.set(key, { at: c.createdAt, actor: actor(c.sender) });
    }

    const rows: Row[] = [
      ...[...byPost.entries()].map(
        ([postId, g]): Row => ({
          kind: 'like',
          id: `like_${postId}_${g.at.getTime()}`,
          at: g.at,
          postId,
          media: mediaOf.get(postId) ?? 'picture',
          thumb: thumbOf.get(postId) ?? null,
          actors: g.actors,
          others: g.others,
        }),
      ),
      ...follows.map(
        (f): Row => ({
          kind: 'follow',
          id: `follow_${String(f._id)}`,
          at: f.createdAt,
          actor: actor(f.followerUser),
        }),
      ),
      ...subs.map(
        (s): Row => ({
          kind: 'subscribe',
          id: `sub_${String(s._id)}`,
          at: s.createdAt,
          actor: actor(s.user),
        }),
      ),
      ...[...byCard.entries()].map(
        ([key, g]): Row => ({ kind: 'card', id: `card_${key}`, at: g.at, actor: g.actor }),
      ),
    ].sort((a, b) => b.at.getTime() - a.at.getTime());

    const page = rows.slice(0, PAGE);
    const seenAt = viewer?.notificationsSeenAt ?? null;
    /* A pending request stays pinned in the panel until it is answered, but it stops being
       *new* the moment the reader has seen it — counting it unconditionally was what left the
       bell showing 1 again after every reload, however many times the panel had been opened. */
    const unread = before
      ? 0
      : page.filter((r) => !seenAt || r.at > seenAt).length +
        partner.filter((p) => !seenAt || p.createdAt > seenAt).length;

    res.json({
      success: true,
      data: {
        unread,
        /* the client's first block: an active ad in miniature, or the invitation to make one */
        ads: activeAd
          ? {
              active: {
                id: String(activeAd._id),
                adType: activeAd.adType ?? '',
                media: activeAd.media ?? null,
              },
            }
          : { active: null },
        partner: partner.map((p) => ({
          id: String(p._id),
          at: p.createdAt,
          business: actor(p.business),
        })),
        items: page,
        hasMore: rows.length > PAGE,
      },
    });
  }),
);

/** The reader opened the panel: everything up to now stops counting towards the bell. */
notificationsRouter.post(
  '/seen',
  requireAuth,
  asyncHandler(async (req, res) => {
    await User.updateOne(
      { _id: req.auth!.userId },
      { $set: { notificationsSeenAt: new Date() } },
    );
    res.json({ success: true });
  }),
);

/** Accept or decline a vinculacion request — the two buttons in the purple modal. */
notificationsRouter.post(
  '/partner/:id/:answer',
  requireAuth,
  asyncHandler(async (req, res) => {
    const answer =
      req.params.answer === 'accept'
        ? 'accepted'
        : req.params.answer === 'decline'
          ? 'declined'
          : null;
    if (!answer) throw ApiError.badRequest('Answer must be accept or decline.');

    const request = await PartnerRequest.findOne({
      _id: req.params.id,
      target: req.auth!.userId,
    });
    if (!request) throw ApiError.notFound('Request not found');
    if (request.status !== 'pending') {
      throw ApiError.badRequest('This request has already been answered.');
    }

    request.status = answer;
    request.respondedAt = new Date();
    await request.save();

    /* Accepting records the link and nothing more for now. What a linked business may then do —
       manage this account's ads, post to its profile — is the separate piece of work, and
       granting it here before that exists would hand out a permission nothing checks. */
    res.json({ success: true, status: request.status });
  }),
);
