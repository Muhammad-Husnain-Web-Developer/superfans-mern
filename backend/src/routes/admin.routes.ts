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
      .select('name usernameUrl email role status verified vip noOfFollowers growthStatus growthGearLevel createdAt')
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
      })
      .parse(req.body);
    await User.updateOne({ _id: req.params.id }, { $set: body });
    res.json({ success: true, message: 'User updated successfully' });
  }),
);

adminRouter.delete(
  '/users/:id',
  requireAuth,
  admin(async (req, res) => {
    await User.deleteOne({ _id: req.params.id });
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
        .select('name usernameUrl email role status verified vip noOfFollowers growthStatus growthGearLevel createdAt')
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
    const posts = await Post.find({ influencer: req.params.id })
      .select('mysqlId imageVideo noOfLikes likePercent likePercentManual createdAt')
      .sort({ mysqlId: -1, createdAt: -1 })
      .setOptions({ withMissing: true })
      .lean();

    res.json({
      success: true,
      user: { id: String(u._id), usernameUrl: u.usernameUrl, mysqlId: u.mysqlId },
      posts: posts.map((p) => ({
        id: String(p._id),
        postId: p.mysqlId ?? null,
        imageVideo: p.imageVideo ?? null,
        noOfLikes: p.noOfLikes ?? 0,
        likePercent: p.likePercent ?? null,
        /* the table marks these with a padlock: "apply to all" steps over them */
        likePercentManual: !!p.likePercentManual,
      })),
    });
  }),
);

/** update_likes — the same add/remove pair, on a post (:2077). */
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

    if (action === 'add') {
      p.noOfLikes = current + amount;
      await p.save();
      res.json({ success: true, noOfLikes: p.noOfLikes, message: 'Likes Added Succesfully' });
      return;
    }

    if (current < amount) {
      throw ApiError.badRequest('remove likes value must be equal to or less than likes');
    }
    p.noOfLikes = current - amount;
    await p.save();
    res.json({ success: true, noOfLikes: p.noOfLikes, message: 'Likes Removed Successfully' });
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

/** Run one growth tick for all active-growth users — port of processGrowth (cron target). */
adminRouter.post('/growth/process/run', requireAuth, admin(async (_req, res) => {
  const users = await User.find({ growthStatus: 'active' });
  const rand = (n: number) => Math.floor(Math.random() * n) + 1;
  let processed = 0;
  for (const u of users) {
    const gear = u.growthGearLevel ?? 1;
    const posts = await Post.find({ influencer: u._id }).sort({ createdAt: -1 }).limit(10);
    for (const p of posts) {
      (p as unknown as { noOfLikes: number }).noOfLikes = ((p as unknown as { noOfLikes?: number }).noOfLikes ?? 0) + rand(gear);
      await p.save();
    }
    u.noOfFollowers = (u.noOfFollowers ?? 0) + rand(gear * 2);
    await u.save();
    processed++;
  }
  res.json({ success: true, message: `Growth processed for ${processed} user(s)`, processed });
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

/* ================= DTOs ================= */
function userDto(u: { _id: unknown; name?: string; usernameUrl?: string; email?: string; role?: string; status?: string; verified?: boolean; vip?: boolean; noOfFollowers?: number; growthStatus?: string; growthGearLevel?: number; createdAt?: Date }) {
  return {
    id: String(u._id), name: u.name ?? '', usernameUrl: u.usernameUrl ?? '', email: u.email ?? '',
    role: u.role ?? 'user', status: u.status ?? 'active', verified: !!u.verified, vip: !!u.vip,
    noOfFollowers: u.noOfFollowers ?? 0, growthStatus: u.growthStatus ?? 'inactive', growthGearLevel: u.growthGearLevel ?? 1,
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
