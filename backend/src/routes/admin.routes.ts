import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/errors.js';
import { saveBase64Image } from '../services/storage.js';
import { User } from '../models/User.js';
import { Subscription } from '../models/Subscription.js';
import { Ad, AdPayment } from '../models/ads.js';
import { Post } from '../models/Post.js';
import { Coupon, Package, PackageInclude, Modal, Asset, WaterMark, Cart } from '../models/adminEntities.js';
import { ReachLock } from '../models/ReachLock.js';
import { forgetLocks } from '../utils/worldReach.js';
import { invalidateWorldPool } from './world.routes.js';
import { usernameUrlMatch } from '../utils/username.js';

export const adminRouter = Router();

/**
 * Admin guard — Laravel gates the panel on the `admin` middleware (role admin /
 * id 4465).
 *
 * Id 100 is here for the same reason it is written into the blade's own
 * controller: InfluencerController::all_users answers only `$logged == '100'`,
 * and that account is the owner's. His role stays `influencer`, which is what
 * his public profile is built on, so the id is what grants the panel.
 */
const OWNER_MYSQL_ID = 100;
const ADS_ADMIN_MYSQL_ID = 4465;

async function requireAdmin(userId: string): Promise<void> {
  const u = await User.findById(userId, { role: 1, mysqlId: 1 });
  const allowed =
    u && (u.role === 'admin' || u.mysqlId === ADS_ADMIN_MYSQL_ID || u.mysqlId === OWNER_MYSQL_ID);
  if (!allowed) throw ApiError.forbidden('Admin access only');
}

/** A typed search term is data, not a pattern: every regex metacharacter in it is made
    literal so a stray "(" or "*" cannot break the query or cost the server real work. */
function escapeRegex(v: string): string {
  let out = '';
  for (const ch of v) out += /[A-Za-z0-9_]/.test(ch) ? ch : `\\${ch}`;
  return out;
}

/** Wrap every admin route: auth + admin check, then the handler. */
function admin(handler: (req: import('express').Request, res: import('express').Response) => Promise<void>) {
  return asyncHandler(async (req, res) => {
    await requireAdmin(req.auth!.userId);
    await handler(req, res);
  });
}

/** If value is a base64 data URL, persist it and return the filename; else return as-is. */
async function resolveImage(v: unknown): Promise<string | undefined> {
  if (typeof v === 'string' && v.startsWith('data:')) return saveBase64Image(v);
  return typeof v === 'string' && v ? v : undefined;
}

/* ================= dashboard stats ================= */
adminRouter.get(
  '/stats',
  requireAuth,
  admin(async (_req, res) => {
    const [sales, users, subscriptions] = await Promise.all([
      Cart.countDocuments({ paymentStatus: 1 }),
      User.countDocuments({ role: { $nin: ['admin', 'dummy'] } } as Record<string, unknown>),
      Subscription.countDocuments({}),
    ]);
    // Fall back to ad payments if no merch carts are persisted yet.
    const salesCount = sales || (await AdPayment.countDocuments({}));
    res.json({ success: true, stats: { sales: salesCount, users, subscriptions } });
  }),
);

/* ================= users ================= */
adminRouter.get(
  '/users',
  requireAuth,
  admin(async (_req, res) => {
    const users = await User.find({ role: { $nin: ['admin', 'dummy'] } } as Record<string, unknown>)
      .select('name usernameUrl email role status verified vip noOfFollowers earnings videoAdsEarnings growthStatus growthGearLevel createdAt')
      .sort({ createdAt: -1 })
      .limit(1000)
      .lean();
    res.json({ success: true, users: users.map(userDto) });
  }),
);

adminRouter.get(
  '/users/:id',
  requireAuth,
  admin(async (req, res) => {
    const u = await User.findById(req.params.id).lean();
    if (!u) throw ApiError.notFound('User not found');
    res.json({ success: true, user: userDto(u) });
  }),
);

adminRouter.put(
  '/users/:id',
  requireAuth,
  admin(async (req, res) => {
    const body = z
      .object({
        name: z.string().optional(),
        email: z.string().email().optional(),
        usernameUrl: z.string().optional(),
        role: z.enum(['user', 'influencer', 'business', 'admin']).optional(),
        status: z.enum(['active', 'suspended', 'deleted']).optional(),
        verified: z.boolean().optional(),
        vip: z.boolean().optional(),
        /* Set by hand from the admin table. There is one earnings figure per user — in
           Laravel too, where `users.earnings` is the total and `earnings_logs` only breaks
           down what it was paid for. Video Ads has no bucket of its own, so the client's
           "manipulate Video Ads earnings" lands here, on the total, as he confirmed. */
        earnings: z.number().min(0).optional(),
        videoAdsEarnings: z.number().min(0).optional(),
      })
      .parse(req.body);

    /* Only a creator earns. A fan is on the paying side of this platform and a business
       account buys ads rather than being paid for them, so neither has anywhere to show a
       figure — the blade gives them no payments block at all. Setting one on them would
       write a number nobody could ever see, so it is refused here rather than silently
       stored. The role the check reads is the one about to be saved, if this same request
       is changing it. */
    if (body.earnings !== undefined || body.videoAdsEarnings !== undefined) {
      const target = await User.findById(req.params.id, { role: 1 }).lean();
      if (!target) throw ApiError.notFound('User not found');
      const role = body.role ?? target.role;
      if (role !== 'influencer') {
        throw ApiError.badRequest('Earnings can only be set on a creator account.');
      }
    }

    /* a nickname no other account holds in any capitals — a URL must name one profile */
    if (body.usernameUrl) {
      const taken = await User.exists({ usernameUrl: usernameUrlMatch(body.usernameUrl), _id: { $ne: req.params.id } });
      if (taken) throw ApiError.badRequest('The username is already associated with an account');
    }
    await User.updateOne({ _id: req.params.id }, { $set: body });
    /* the WORLD pool keeps only active creators, so a status written here has to reach the
       wall now rather than whenever the pool next expires */
    if (body.status !== undefined) invalidateWorldPool();
    res.json({ success: true, message: 'User updated successfully' });
  }),
);

adminRouter.delete(
  '/users/:id',
  requireAuth,
  admin(async (req, res) => {
    await User.deleteOne({ _id: req.params.id });
    /* with the row gone the pool's lookup no longer matches them — but only once it is
       rebuilt, so ask for that now */
    invalidateWorldPool();
    res.json({ success: true, message: 'User deleted successfully' });
  }),
);

/** The panel's own list: everyone, 700 to a page, in id order (User::paginate(700)).
    This is not admin/users, which drops admins and dummies (AdminController:76). */
adminRouter.get(
  '/all-users',
  requireAuth,
  admin(async (req, res) => {
    const perPage = 700;
    const page = Math.max(1, Number(req.query.page ?? 1));

    /* The table's own Search box only ever saw the 700 rows on screen, so looking a user
       up meant guessing which page they were on. The box now asks the server instead and
       the whole table is the haystack. Blank means everybody, as before. */
    const term = String(req.query.search ?? '').trim();
    const filter = term
      ? {
          $or: [
            { usernameUrl: { $regex: escapeRegex(term), $options: 'i' } },
            { email: { $regex: escapeRegex(term), $options: 'i' } },
            { name: { $regex: escapeRegex(term), $options: 'i' } },
          ],
        }
      : {};

    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .select('name usernameUrl email role status verified vip noOfFollowers earnings videoAdsEarnings growthStatus growthGearLevel createdAt')
        .sort({ mysqlId: 1, createdAt: 1 })
        .skip((page - 1) * perPage)
        .limit(perPage)
        .lean(),
    ]);
    res.json({
      success: true,
      users: users.map(userDto),
      page,
      perPage,
      total,
      search: term,
      lastPage: Math.max(1, Math.ceil(total / perPage)),
    });
  }),
);

/* ================= all_users panel =================
   The actions behind influencer/all_users.blade.php. Each answers with the very
   sentence the blade flashes, since those are what the page prints back. */

/** suspendUser — a toggle, not a setter (InfluencerController:1990). */
adminRouter.post(
  '/users/:id/suspend',
  requireAuth,
  admin(async (req, res) => {
    const u = await User.findById(req.params.id);
    if (!u) throw ApiError.notFound('User not found');
    const suspended = u.status === 'suspended';
    u.status = suspended ? 'active' : 'suspended';
    await u.save();
    /* Both directions: suspending has to take the account off the wall at once — an admin
       who suspends someone and then looks at WORLD is checking exactly this — and
       unsuspending has to put them back just as promptly. */
    invalidateWorldPool();
    res.json({
      success: true,
      status: u.status,
      message: suspended ? 'User unsuspended successfully.' : 'User suspended successfully.',
    });
  }),
);

/** deleteUser — also a toggle: the row stays, only its status moves (:2007). */
adminRouter.post(
  '/users/:id/delete-toggle',
  requireAuth,
  admin(async (req, res) => {
    const u = await User.findById(req.params.id);
    if (!u) throw ApiError.notFound('User not found');
    const deleted = u.status === 'deleted';
    u.status = deleted ? 'active' : 'deleted';
    await u.save();
    /* the same reason as the suspend toggle above: this is the status the WORLD pool filters
       on, and the wall would otherwise keep serving the pool it built before the change */
    invalidateWorldPool();
    res.json({
      success: true,
      status: u.status,
      message: deleted ? 'User restored successfully.' : 'User deleted successfully.',
    });
  }),
);

/** update_followers — add, or remove without ever going below what is there (:1885). */
adminRouter.post(
  '/users/:id/followers',
  requireAuth,
  admin(async (req, res) => {
    const { action, amount } = z
      .object({ action: z.enum(['add', 'remove']), amount: z.coerce.number().int() })
      .parse(req.body);

    const u = await User.findById(req.params.id);
    if (!u) throw ApiError.notFound('User not found');
    const current = u.noOfFollowers ?? 0;

    if (action === 'add') {
      u.noOfFollowers = current + amount;
      await u.save();
      res.json({ success: true, noOfFollowers: u.noOfFollowers, message: 'Followers Added Succesfully' });
      return;
    }

    if (current < amount) {
      throw ApiError.badRequest('remove followers value must be equal to or less than followers');
    }
    u.noOfFollowers = current - amount;
    await u.save();
    res.json({ success: true, noOfFollowers: u.noOfFollowers, message: 'Followers Removed Successfully' });
  }),
);

/** all_user_posts — every post of one user, newest first (:1943). */
adminRouter.get(
  '/users/:id/posts',
  requireAuth,
  admin(async (req, res) => {
    const u = await User.findById(req.params.id, { mysqlId: 1, usernameUrl: 1 }).lean();
    if (!u) throw ApiError.notFound('User not found');
    /* the panel is the one place that should see everything, including the
       posts whose media went missing in the migration */
    /* createdAt leads: a post made straight in this app has no mysqlId, and sorting on that
       field first sank every such post below every migrated one regardless of recency — see
       the same fix in profiles.routes.ts / posts.routes.ts. */
    const posts = await Post.find({ influencer: req.params.id })
      .select('mysqlId imageVideo noOfLikes noOfViews likePercent likePercentManual createdAt')
      .sort({ createdAt: -1, mysqlId: -1 })
      .setOptions({ withMissing: true })
      .lean();

    res.json({
      success: true,
      user: { id: String(u._id), usernameUrl: u.usernameUrl, mysqlId: u.mysqlId },
      posts: posts.map((p) => ({
        id: String(p._id),
        postId: p.mysqlId ?? null,
        imageVideo: p.imageVideo ?? null,
        /* the column is headed "Views", so it shows the view figure the eye shows */
        noOfViews: p.noOfViews ?? 0,
        noOfLikes: p.noOfLikes ?? 0,
        likePercent: p.likePercent ?? null,
        /* the table marks these with a padlock: "apply to all" steps over them */
        likePercentManual: !!p.likePercentManual,
      })),
    });
  }),
);

/**
 * update_likes — the same add/remove pair, on a post (:2077).
 *
 * The box is labelled "Add Views", and it moves both figures in step, exactly as the growth
 * bot does. In Laravel there was only ever one number — `no_of_likes` was also the view
 * count (`SUM(posts.no_of_likes) as total_views`, InfluencerController:502) — so a single
 * `$inc` satisfied both readings. Now that the eye has its own field, moving only one of
 * them breaks whichever reading is left behind: writing likes alone leaves the eye still
 * after the admin has just added views to it, and writing views alone stops the box pushing
 * a post over the `noOfLikes >= 1000` line into the WORLD pool, which is what it was for.
 * So both, together, and both floored at zero.
 */
adminRouter.post(
  '/posts/:id/likes',
  requireAuth,
  admin(async (req, res) => {
    const { action, amount } = z
      .object({ action: z.enum(['add', 'remove']), amount: z.coerce.number().int() })
      .parse(req.body);

    const p = await Post.findById(req.params.id).setOptions({ withMissing: true });
    if (!p) throw ApiError.notFound('Post not found');
    const current = p.noOfLikes ?? 0;
    const currentViews = p.noOfViews ?? 0;

    if (action === 'add') {
      p.noOfLikes = current + amount;
      p.noOfViews = currentViews + amount;
      await p.save();
      res.json({
        success: true,
        noOfLikes: p.noOfLikes,
        noOfViews: p.noOfViews,
        message: 'Views Added Succesfully',
      });
      return;
    }

    if (current < amount) {
      throw ApiError.badRequest('remove likes value must be equal to or less than likes');
    }
    p.noOfLikes = current - amount;
    /* the eye was seeded a little above likes (it carried the real Like rows too), so it
       can legitimately still be positive here — clamp rather than go negative */
    p.noOfViews = Math.max(0, currentViews - amount);
    await p.save();
    res.json({
      success: true,
      noOfLikes: p.noOfLikes,
      noOfViews: p.noOfViews,
      message: 'Views Removed Successfully',
    });
  }),
);

/** update the admin-typed like percentage on one post. `percent: null` clears it, so the
    pill falls back to the real like/hate rows. */
adminRouter.post(
  '/posts/:id/like-percent',
  requireAuth,
  admin(async (req, res) => {
    const { percent } = z
      .object({ percent: z.coerce.number().min(0).max(100).nullable() })
      .parse(req.body);

    const p = await Post.findById(req.params.id).setOptions({ withMissing: true });
    if (!p) throw ApiError.notFound('Post not found');
    p.likePercent = percent === null ? null : Math.round(percent);
    /* Typed on this post on its own, so "apply to all" must not touch it again. Clearing
       the box lifts that protection, which is the only way back into the bulk apply. */
    p.likePercentManual = percent !== null;
    await p.save();
    res.json({
      success: true,
      likePercent: p.likePercent,
      likePercentManual: p.likePercentManual,
      message: percent === null ? 'Percentage cleared' : 'Percentage saved',
    });
  }),
);

/* The client asked for the bulk figure to land differently on each post rather than the
   same number everywhere: three either side of what was typed, so 17 spreads over
   14…20. The band is clipped at 0 and 100 so the ends of the scale stay legal. */
export const LIKE_PERCENT_SPREAD = 3;
function spreadPercent(base: number): number {
  const low = Math.max(0, base - LIKE_PERCENT_SPREAD);
  const high = Math.min(100, base + LIKE_PERCENT_SPREAD);
  return low + Math.floor(Math.random() * (high - low + 1));
}

/** One figure per post across a whole influencer — the "help an influencer" bulk apply,
    the counterpart of starting the growth engine on a user. */
adminRouter.post(
  '/users/:id/like-percent',
  requireAuth,
  admin(async (req, res) => {
    const { percent } = z
      .object({ percent: z.coerce.number().min(0).max(100).nullable() })
      .parse(req.body);

    const u = await User.findById(req.params.id, { _id: 1 }).lean();
    if (!u) throw ApiError.notFound('User not found');
    const value = percent === null ? null : Math.round(percent);

    /* Posts carrying a hand-typed figure are left exactly as they are, applying and
       clearing alike — the client's rule is that an individual judgement stands. The
       admin can still reach one by emptying its own box first. */
    const posts = await Post.find(
      { influencer: req.params.id },
      { _id: 1, likePercentManual: 1 },
    )
      .setOptions({ withMissing: true })
      .lean();
    const open = posts.filter((p) => !p.likePercentManual);
    const kept = posts.length - open.length;

    /* every post gets its own figure from the band, so a row of posts does not read as one
       number stamped across all of them. They are worked out before the write and sent
       back with the response, so the table can show what actually landed on each row
       without the admin having to reload the page to find out. */
    const applied = open.map((p) => ({
      id: String(p._id),
      likePercent: value === null ? null : spreadPercent(value),
    }));

    if (applied.length > 0) {
      await Post.bulkWrite(
        applied.map((a) => ({
          updateOne: { filter: { _id: a.id }, update: { $set: { likePercent: a.likePercent } } },
        })),
      );
    }

    const keptNote = kept > 0 ? `, ${kept} left as set by hand` : '';
    res.json({
      success: true,
      likePercent: value,
      /** what landed on each post, so the table can update in place */
      applied,
      modified: open.length,
      kept,
      message:
        percent === null
          ? `Percentage cleared on ${open.length} post(s)${keptNote}`
          : `${value}% (±${LIKE_PERCENT_SPREAD}) applied to ${open.length} post(s)${keptNote}`,
    });
  }),
);

/* ================= influencer/ads — Ad Management =================
   The owner's ad list (InfluencerController::ads, gated on id 100 as the users
   panel is). Rows are the `ads` table itself, newest id first. */

adminRouter.get(
  '/ad-management',
  requireAuth,
  admin(async (_req, res) => {
    const ads = await Ad.find({}, { mysqlId: 1, media: 1, link: 1, status: 1 })
      .sort({ mysqlId: -1 })
      .lean();
    res.json({
      success: true,
      ads: ads.map((a) => ({
        id: String(a._id),
        adId: a.mysqlId ?? null,
        media: a.media ?? null,
        link: a.link ?? null,
        /* the column is a 0/1 in MySQL and a boolean here; both read as "is it
           running" */
        status: !!a.status,
      })),
    });
  }),
);

/** addAd — the upload form under the "Add New Ad" button (:2208). */
adminRouter.post(
  '/ad-management',
  requireAuth,
  admin(async (req, res) => {
    const { media, link } = z
      .object({ media: z.string().min(1), link: z.string().url().optional().or(z.literal('')) })
      .parse(req.body);

    const filename = await resolveImage(media);
    if (!filename) throw ApiError.badRequest('Media file is required');

    /* ids here are the migrated MySQL ones, so a new row continues that run */
    const highest = await Ad.findOne({}, { mysqlId: 1 }).sort({ mysqlId: -1 }).lean();
    await Ad.create({
      mysqlId: (highest?.mysqlId ?? 0) + 1,
      media: filename,
      link: link || undefined,
      status: false, // the blade inserts status 0
    });
    res.json({ success: true, message: 'Ad added successfully' });
  }),
);

/** toggleAd — running <-> stopped (:2231). */
adminRouter.post(
  '/ad-management/:id/toggle',
  requireAuth,
  admin(async (req, res) => {
    const ad = await Ad.findById(req.params.id);
    if (!ad) throw ApiError.notFound('Ad not found');
    ad.status = !ad.status;
    await ad.save();
    res.json({ success: true, status: ad.status, message: 'Ad status changed' });
  }),
);

/** deleteAd — the row goes, as the blade's does (:2243). */
adminRouter.post(
  '/ad-management/:id/delete',
  requireAuth,
  admin(async (req, res) => {
    await Ad.deleteOne({ _id: req.params.id });
    res.json({ success: true, message: 'Ad deleted' });
  }),
);

/* ================= growth engine ================= */
/** Toggle a user's automatic growth on/off at a gear level — port of startAutomaticGrowth. */
adminRouter.post('/growth/:userId', requireAuth, admin(async (req, res) => {
  const { gear } = z.object({ gear: z.coerce.number().min(1).max(5).optional() }).parse(req.body);
  const u = await User.findById(req.params.userId);
  if (!u) throw ApiError.notFound('User not found');
  if (u.growthStatus === 'active') {
    u.growthStatus = 'inactive';
    await u.save();
    res.json({ success: true, message: 'Growth stopped.', growthStatus: 'inactive' });
    return;
  }
  u.growthStatus = 'active';
  u.growthGearLevel = gear ?? 1;
  u.growthStartTime = new Date();
  u.followerGrowthTime = new Date();
  await u.save();
  res.json({ success: true, message: `Growth started at Gear ${u.growthGearLevel}`, growthStatus: 'active', growthGearLevel: u.growthGearLevel });
}));

/**
 * One growth tick — port of Laravel's scheduled `growth:process` command
 * (app/Console/Commands/ProcessUserGrowth.php), which its Kernel runs every minute.
 *
 * This replaces an earlier port of `InfluencerController::processGrowth()` — the same app's
 * *other*, cruder growth routine, which adds a flat `rand(1, gear)` to the newest ten posts
 * and is not scheduled anywhere. That one was the wrong source: on a large account it adds
 * one to five likes a tick, which is invisible, and the fields the real command keeps its
 * place with — `Post.growthStartTime`, `User.followerGrowthTime` — were already carried into
 * our schema and sat unused. This is the engine the client has been watching.
 *
 * What it does, per the command:
 *  · a post grows on an interval set by its age — every minute under 48h, every hour under
 *    312h (13 days), every 11 hours after that — so a new post climbs and an old one drifts.
 *  · the amount is proportional: 0.5% of the account's followers, times a gear multiplier,
 *    times a 0.8–1.2 jitter, and never less than 1.
 *  · followers move on their own 150-minute clock, same base, slightly gentler gears.
 *
 * Two deliberate additions the client asked for (1 Oct 2026):
 *  · views grow alongside likes — "if they have VISIBLE Posts and they are boted by admin,
 *    Posts should be more Views";
 *  · only `visible` posts are touched. The blade's command takes every post.
 */
const LIKE_GEAR: Record<number, number> = { 1: 0.5, 2: 1, 3: 1.5, 4: 2.5, 5: 3.5 };
const FOLLOWER_GEAR: Record<number, number> = { 1: 0.5, 2: 1, 3: 1.5, 4: 2, 5: 3 };

export async function runGrowthTick(): Promise<{ users: number; posts: number }> {
  const users = await User.find({ growthStatus: 'active' });
  const now = Date.now();
  const minutesSince = (d?: Date | null, fallback = 0) =>
    d ? (now - new Date(d).getTime()) / 60000 : fallback;
  const jitter = () => (Math.floor(Math.random() * 41) + 80) / 100; // 0.80 – 1.20

  let touchedPosts = 0;
  for (const u of users) {
    const gear = u.growthGearLevel ?? 1;
    const followers = u.noOfFollowers ?? 0;
    const base = Math.ceil(followers * 0.005);

    const posts = await Post.find({ influencer: u._id, visible: true });
    for (const p of posts) {
      const ageHours = (now - new Date(p.createdAt).getTime()) / 3600000;
      const interval = ageHours < 48 ? 1 : ageHours < 312 ? 60 : 660;
      /* no mark yet means "due now", the same as the command's subMinutes(2) default */
      if (minutesSince(p.growthStartTime, interval) < interval) continue;

      const growth = Math.max(1, Math.trunc(base * (LIKE_GEAR[gear] ?? 1) * jitter()));
      await Post.updateOne(
        { _id: p._id },
        { $inc: { noOfLikes: growth, noOfViews: growth }, $set: { growthStartTime: new Date() } },
      );
      touchedPosts++;
    }

    if (minutesSince(u.followerGrowthTime, 180) >= 150) {
      const fBase = Math.max(1, Math.ceil(followers * 0.005));
      const growth = Math.max(1, Math.trunc(fBase * (FOLLOWER_GEAR[gear] ?? 1) * jitter()));
      u.noOfFollowers = followers + growth;
      u.followerGrowthTime = new Date();
      await u.save();
    }
  }
  return { users: users.length, posts: touchedPosts };
}

adminRouter.post('/growth/process/run', requireAuth, admin(async (_req, res) => {
  const { users, posts } = await runGrowthTick();
  res.json({ success: true, message: `Growth processed for ${users} user(s), ${posts} post(s)`, processed: users });
}));

/* ================= coupons ================= */
adminRouter.get('/coupons', requireAuth, admin(async (_req, res) => {
  const coupons = await Coupon.find().sort({ createdAt: -1 }).lean();
  res.json({ success: true, coupons: coupons.map(couponDto) });
}));

adminRouter.get('/coupons/:id', requireAuth, admin(async (req, res) => {
  const c = await Coupon.findById(req.params.id).lean();
  if (!c) throw ApiError.notFound('Coupon not found');
  res.json({ success: true, coupon: couponDto(c) });
}));

const couponBody = z.object({
  name: z.string().optional(),
  code: z.string().min(1),
  amount: z.coerce.number(),
  type: z.string().optional(),
  expiry_date: z.string().optional(),
  limit_one: z.coerce.number().optional(),
});

adminRouter.post('/coupons', requireAuth, admin(async (req, res) => {
  const b = couponBody.parse(req.body);
  await Coupon.create({ name: b.name, code: b.code, amount: b.amount, type: b.type, expiryDate: b.expiry_date, limitOne: b.limit_one ?? 0 });
  res.json({ success: true, message: 'Coupon added successfully' });
}));

adminRouter.put('/coupons/:id', requireAuth, admin(async (req, res) => {
  const b = couponBody.parse(req.body);
  await Coupon.updateOne({ _id: req.params.id }, { $set: { name: b.name, code: b.code, amount: b.amount, type: b.type, expiryDate: b.expiry_date, limitOne: b.limit_one ?? 0 } });
  res.json({ success: true, message: 'Coupon updated successfully' });
}));

adminRouter.delete('/coupons/:id', requireAuth, admin(async (req, res) => {
  await Coupon.deleteOne({ _id: req.params.id });
  res.json({ success: true, message: 'Coupon deleted successfully' });
}));

/* ================= packages ================= */
adminRouter.get('/packages', requireAuth, admin(async (_req, res) => {
  const packages = await Package.find().sort({ createdAt: -1 }).lean();
  res.json({ success: true, packages: packages.map(packageDto) });
}));

adminRouter.get('/packages/:id', requireAuth, admin(async (req, res) => {
  const p = await Package.findById(req.params.id).lean();
  if (!p) throw ApiError.notFound('Package not found');
  const inc = await PackageInclude.findOne({ package: p._id }).lean();
  res.json({ success: true, package: packageDto(p), includes: inc ? {
    available: inc.available ?? '', unlimited: inc.unlimited ?? '', twentyFourHourFree: inc.twentyFourHourFree ?? '', free: inc.free ?? '',
  } : null });
}));

adminRouter.put('/packages/:id', requireAuth, admin(async (req, res) => {
  const b = z.object({
    name: z.string().optional(), price: z.coerce.number().optional(), desc: z.string().optional(),
    duration: z.coerce.number().optional(), duration_unit: z.string().optional(),
    available: z.string().optional(), unlimited: z.string().optional(),
    twenty_four_hour_free: z.string().optional(), free: z.string().optional(),
  }).parse(req.body);
  await Package.updateOne({ _id: req.params.id }, { $set: { name: b.name, price: b.price, desc: b.desc, duration: b.duration, durationUnit: b.duration_unit } });
  await PackageInclude.updateOne(
    { package: req.params.id },
    { $set: { available: b.available, unlimited: b.unlimited, twentyFourHourFree: b.twenty_four_hour_free, free: b.free }, $setOnInsert: { package: req.params.id } },
    { upsert: true },
  );
  res.json({ success: true, message: 'Package updated successfully' });
}));

/* ================= watermarks ================= */
adminRouter.get('/watermarks', requireAuth, admin(async (_req, res) => {
  const list = await WaterMark.find().sort({ createdAt: -1 }).lean();
  res.json({ success: true, watermarks: list.map((w) => ({ id: String(w._id), image: w.image ?? null })) });
}));

adminRouter.post('/watermarks', requireAuth, admin(async (req, res) => {
  const image = await resolveImage(req.body.image);
  if (!image) throw ApiError.badRequest('Watermark image is required');
  await WaterMark.create({ image });
  res.json({ success: true, message: 'Watermark added successfully' });
}));

adminRouter.put('/watermarks/:id', requireAuth, admin(async (req, res) => {
  const image = await resolveImage(req.body.image);
  if (image) await WaterMark.updateOne({ _id: req.params.id }, { $set: { image } });
  res.json({ success: true, message: 'Watermark updated successfully' });
}));

adminRouter.delete('/watermarks/:id', requireAuth, admin(async (req, res) => {
  await WaterMark.deleteOne({ _id: req.params.id });
  res.json({ success: true, message: 'Watermark deleted successfully' });
}));

/* ================= merch models (Modal) ================= */
adminRouter.get('/models', requireAuth, admin(async (_req, res) => {
  const models = await Modal.find().sort({ createdAt: -1 }).lean();
  res.json({ success: true, models: models.map(modalDto) });
}));

adminRouter.get('/models/:id', requireAuth, admin(async (req, res) => {
  const m = await Modal.findById(req.params.id).lean();
  if (!m) throw ApiError.notFound('Model not found');
  res.json({ success: true, model: modalDto(m) });
}));

const modalBody = z.object({ name: z.string().optional(), price: z.coerce.number().optional() });

adminRouter.post('/models', requireAuth, admin(async (req, res) => {
  const b = modalBody.parse(req.body);
  const icon = await resolveImage(req.body.icon);
  const image = await resolveImage(req.body.image);
  await Modal.create({ name: b.name, price: b.price, icon, image });
  res.json({ success: true, message: 'Model added successfully' });
}));

adminRouter.put('/models/:id', requireAuth, admin(async (req, res) => {
  const b = modalBody.parse(req.body);
  const icon = await resolveImage(req.body.icon);
  const image = await resolveImage(req.body.image);
  const set: Record<string, unknown> = { name: b.name, price: b.price };
  if (icon) set.icon = icon;
  if (image) set.image = image;
  await Modal.updateOne({ _id: req.params.id }, { $set: set });
  res.json({ success: true, message: 'Model updated successfully' });
}));

adminRouter.delete('/models/:id', requireAuth, admin(async (req, res) => {
  await Modal.deleteOne({ _id: req.params.id });
  res.json({ success: true, message: 'Model deleted successfully' });
}));

/* ================= assets ================= */
adminRouter.get('/assets', requireAuth, admin(async (_req, res) => {
  const [assets, watermarks] = await Promise.all([
    Asset.find().sort({ zIndex: 1 }).lean(),
    WaterMark.find().lean(),
  ]);
  res.json({ success: true, assets: assets.map(assetDto), watermarks: watermarks.map((w) => ({ id: String(w._id), image: w.image ?? null })) });
}));

adminRouter.get('/assets/:id', requireAuth, admin(async (req, res) => {
  const a = await Asset.findById(req.params.id).lean();
  if (!a) throw ApiError.notFound('Asset not found');
  const all = await Asset.find().lean();
  res.json({ success: true, asset: assetDto(a), assets: all.map(assetDto) });
}));

const assetBody = z.object({ name: z.string().optional(), parent: z.coerce.number().optional(), z_index: z.coerce.number().optional() });

adminRouter.post('/assets', requireAuth, admin(async (req, res) => {
  const b = assetBody.parse(req.body);
  const icon = await resolveImage(req.body.icon);
  const iconOff = (await resolveImage(req.body.icon_off)) ?? icon;
  const image = await resolveImage(req.body.image);
  await Asset.create({ name: b.name, parent: b.parent, icon, iconOff, image, zIndex: b.z_index ?? 0 });
  res.json({ success: true, message: 'Asset added successfully' });
}));

adminRouter.put('/assets/:id', requireAuth, admin(async (req, res) => {
  const b = assetBody.parse(req.body);
  const set: Record<string, unknown> = {};
  if (b.name) set.name = b.name;
  if (b.parent !== undefined) set.parent = b.parent;
  if (b.z_index !== undefined) set.zIndex = b.z_index;
  const icon = await resolveImage(req.body.icon);
  const iconOff = await resolveImage(req.body.icon_off);
  const image = await resolveImage(req.body.image);
  if (icon) set.icon = icon;
  if (iconOff) set.iconOff = iconOff;
  if (image) set.image = image;
  await Asset.updateOne({ _id: req.params.id }, { $set: set });
  res.json({ success: true, message: 'Asset updated successfully' });
}));

adminRouter.delete('/assets/:id', requireAuth, admin(async (req, res) => {
  await Asset.deleteOne({ _id: req.params.id });
  res.json({ success: true, message: 'Asset deleted successfully' });
}));

/* ================= orders ================= */
adminRouter.get('/orders', requireAuth, admin(async (_req, res) => {
  const orders = await Cart.find({ paymentStatus: 1 })
    .sort({ createdAt: -1 })
    .populate('user', 'usernameUrl name email')
    .populate('modal', 'name price')
    .lean();
  res.json({ success: true, orders: orders.map((o) => orderDto(o as unknown as Parameters<typeof orderDto>[0])) });
}));

adminRouter.get('/orders/:id', requireAuth, admin(async (req, res) => {
  const o = await Cart.findById(req.params.id)
    .populate('user', 'usernameUrl name email')
    .populate('modal', 'name price image')
    .lean();
  if (!o) throw ApiError.notFound('Order not found');
  res.json({ success: true, order: orderDto(o as unknown as Parameters<typeof orderDto>[0]) });
}));

/* ================= reach lockers =================
   The two lockers the client asked for beside his user panel: "Country Zone Post Locker"
   (posts from one place, shown in another) and "User Individual Locker Country" (one
   account's posts, shown in a place). Each writes a figure over what the ladder would have
   given — see models/ReachLock.ts. The WORLD feed reads them through a one-minute cache,
   which every write below drops so the owner sees his rule take at once. */

const lockPlace = z.object({
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, 'country must be an ISO-3166 alpha-2 code'),
  region: z.string().trim().toUpperCase().max(8).nullable().optional().transform((v) => v || null),
});

const lockBody = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('zone'), from: lockPlace, to: lockPlace, percent: z.coerce.number().int().min(0).max(100) }),
  /* the account may be named by id, username or email — whichever the owner has to hand */
  z.object({ kind: z.literal('user'), user: z.string().trim().min(1), to: lockPlace, percent: z.coerce.number().int().min(0).max(100) }),
]);

function lockDto(l: {
  _id: unknown; kind: string; percent: number; createdAt?: Date;
  from?: { country: string; region?: string | null } | null;
  to: { country: string; region?: string | null };
  user?: { _id: unknown; usernameUrl?: string; email?: string } | unknown | null;
}) {
  const u = l.user && typeof l.user === 'object' && 'usernameUrl' in l.user ? (l.user as { _id: unknown; usernameUrl?: string; email?: string }) : null;
  return {
    id: String(l._id),
    kind: l.kind,
    user: u ? { id: String(u._id), usernameUrl: u.usernameUrl ?? '', email: u.email ?? '' } : null,
    from: l.from ? { country: l.from.country, region: l.from.region ?? null } : null,
    to: { country: l.to.country, region: l.to.region ?? null },
    percent: l.percent,
    createdAt: l.createdAt,
  };
}

adminRouter.get('/reach-locks', requireAuth, admin(async (_req, res) => {
  const locks = await ReachLock.find().sort({ kind: 1, createdAt: 1 }).populate('user', 'usernameUrl email').lean();
  res.json({ success: true, locks: locks.map((l) => lockDto(l as unknown as Parameters<typeof lockDto>[0])) });
}));

/* Writing the same pairing twice changes its figure rather than adding a second rule — the
   unique index on the model is what makes the pairing the key. */
adminRouter.post('/reach-locks', requireAuth, admin(async (req, res) => {
  const b = lockBody.parse(req.body);
  const key =
    b.kind === 'zone'
      ? { kind: 'zone' as const, user: null, 'from.country': b.from.country, 'from.region': b.from.region ?? null, 'to.country': b.to.country, 'to.region': b.to.region ?? null }
      : { kind: 'user' as const, user: await resolveLockUser(b.user), from: null, 'to.country': b.to.country, 'to.region': b.to.region ?? null };
  const doc =
    b.kind === 'zone'
      ? { kind: 'zone', user: null, from: b.from, to: b.to, percent: b.percent }
      : { kind: 'user', user: key.user, from: null, to: b.to, percent: b.percent };
  const saved = await ReachLock.findOneAndUpdate(key, doc, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true })
    .populate('user', 'usernameUrl email')
    .lean();
  forgetLocks();
  res.json({ success: true, lock: lockDto(saved as unknown as Parameters<typeof lockDto>[0]) });
}));

adminRouter.put('/reach-locks/:id', requireAuth, admin(async (req, res) => {
  const { percent } = z.object({ percent: z.coerce.number().int().min(0).max(100) }).parse(req.body);
  const saved = await ReachLock.findByIdAndUpdate(req.params.id, { percent }, { returnDocument: 'after' }).populate('user', 'usernameUrl email').lean();
  if (!saved) throw ApiError.notFound('Lock not found');
  forgetLocks();
  res.json({ success: true, lock: lockDto(saved as unknown as Parameters<typeof lockDto>[0]) });
}));

adminRouter.delete('/reach-locks/:id', requireAuth, admin(async (req, res) => {
  const gone = await ReachLock.findByIdAndDelete(req.params.id).lean();
  if (!gone) throw ApiError.notFound('Lock not found');
  forgetLocks();
  res.json({ success: true });
}));

/** The account an individual lock is about, from whatever the owner typed for it. */
async function resolveLockUser(who: string) {
  const byId = /^[0-9a-f]{24}$/i.test(who) ? await User.findById(who, { _id: 1 }).lean() : null;
  const u =
    byId ??
    (await User.findOne(
      { $or: [{ email: who.toLowerCase() }, { usernameUrl: usernameUrlMatch(who.replace(/^@/, '')) }] },
      { _id: 1 },
    ).lean());
  if (!u) throw ApiError.notFound(`No user "${who}"`);
  return u._id;
}

/* ================= DTOs ================= */
function userDto(u: { _id: unknown; name?: string; usernameUrl?: string; email?: string; role?: string; status?: string; verified?: boolean; vip?: boolean; noOfFollowers?: number; earnings?: number; videoAdsEarnings?: number; growthStatus?: string; growthGearLevel?: number; createdAt?: Date }) {
  return {
    id: String(u._id), name: u.name ?? '', usernameUrl: u.usernameUrl ?? '', email: u.email ?? '',
    role: u.role ?? 'user', status: u.status ?? 'active', verified: !!u.verified, vip: !!u.vip,
    noOfFollowers: u.noOfFollowers ?? 0, earnings: u.earnings ?? 0, videoAdsEarnings: u.videoAdsEarnings ?? 0,
    growthStatus: u.growthStatus ?? 'inactive', growthGearLevel: u.growthGearLevel ?? 1,
    createdAt: u.createdAt,
  };
}
function couponDto(c: { _id: unknown; name?: string; code?: string; amount: number; type?: string; expiryDate?: string; limitOne?: number }) {
  return { id: String(c._id), name: c.name ?? '', code: c.code ?? '', amount: c.amount, type: c.type ?? '', expiryDate: c.expiryDate ?? '', limitOne: c.limitOne ?? 0 };
}
function packageDto(p: { _id: unknown; name?: string; price?: number; desc?: string; duration?: number; durationUnit?: string }) {
  return { id: String(p._id), name: p.name ?? '', price: p.price ?? 0, desc: p.desc ?? '', duration: p.duration ?? 0, durationUnit: p.durationUnit ?? '' };
}
function modalDto(m: { _id: unknown; name?: string; price?: number; icon?: string; image?: string }) {
  return { id: String(m._id), name: m.name ?? '', price: m.price ?? 0, icon: m.icon ?? null, image: m.image ?? null };
}
function assetDto(a: { _id: unknown; name?: string; parent?: number; icon?: string; iconOff?: string; image?: string; zIndex?: number }) {
  return { id: String(a._id), name: a.name ?? '', parent: a.parent ?? null, icon: a.icon ?? null, iconOff: a.iconOff ?? null, image: a.image ?? null, zIndex: a.zIndex ?? 0 };
}
function orderDto(o: {
  _id: unknown; paymentStatus: number; createdAt?: Date;
  user?: { usernameUrl?: string; name?: string; email?: string } | null;
  modal?: { name?: string; price?: number; image?: string } | null;
  productName?: string; productPrice?: number; productSlug?: string; buyerEmail?: string;
  glasses?: number; mask?: number; shoes?: number; vest?: number; helmet?: number; headphone?: number; gloves?: number;
}) {
  // A merch-catalogue order stores product fields directly; a designer order references a Modal.
  const productName = o.productName ?? o.modal?.name ?? '';
  const productPrice = o.productPrice ?? o.modal?.price ?? 0;
  return {
    id: String(o._id),
    paymentStatus: o.paymentStatus,
    createdAt: o.createdAt,
    user: o.user ? { usernameUrl: o.user.usernameUrl ?? '', name: o.user.name ?? '', email: o.user.email ?? '' } : null,
    buyerEmail: o.buyerEmail ?? o.user?.email ?? '',
    modal: { name: productName, price: productPrice, image: o.modal?.image ?? null },
    productSlug: o.productSlug ?? '',
    parts: { glasses: o.glasses, mask: o.mask, shoes: o.shoes, vest: o.vest, helmet: o.helmet, headphone: o.headphone, gloves: o.gloves },
  };
}
