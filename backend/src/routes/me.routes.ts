import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/errors.js';
import { User } from '../models/User.js';
import { Followership } from '../models/Followership.js';
import { Subscription } from '../models/Subscription.js';
import { Hate } from '../models/Hate.js';
import { sendMail } from '../services/mailer.js';
import { renderEmail } from '../services/emailTemplate.js';
import { priceIncrease } from '../services/adEmails.js';

const ADMIN_PAYOUT_EMAIL = 'dmartinherrada@gmail.com';
import { Like } from '../models/Like.js';
import { Post } from '../models/Post.js';

export const meRouter = Router();

/**
 * Account settings — ports the many single-field endpoints the blade's control
 * panel posts to (update_name / update_surname / update_email / update_password /
 * update_bio / update_username_url / updateCoverColor / update_birth /
 * update_country / update_gender / footer_name_username, and the image updates).
 * Laravel exposes one route per field; we accept them together but keep the exact
 * validation rules (unique email, unique username, bio max 500).
 */
const settingsSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  surname: z.string().max(255).optional(),
  email: z.string().email().max(255).optional(),
  password: z.string().min(8).max(255).optional(),
  bio: z.string().max(500).optional(),
  usernameUrl: z.string().min(1).max(200).optional(),
  coverColor: z.string().max(20).optional(),
  profilePicture: z
    .string()
    .regex(/^image_\d+\d*\.png$/)
    .optional(),
  coverPicture: z
    .string()
    .regex(/^image_\d+\d*\.png$/)
    .optional(),
  birth: z.string().max(40).optional(),
  country: z.string().max(80).optional(),
  gender: z.string().max(40).optional(),
  footerNameUsername: z.string().max(40).optional(),
  profilePictureBorderStatus: z.enum(['0', '1']).optional(),
  instagramLink: z.string().max(255).optional(),
  bankAccount: z.string().max(255).optional(),
  paypalAccount: z.string().max(255).optional(),
  priceOfSubscription: z.coerce.number().min(0).optional(),
  earnings: z.coerce.number().min(0).optional(),
  chatToggle: z.boolean().optional(),
});

meRouter.patch(
  '/settings',
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = settingsSchema.parse(req.body);
    const user = await User.findById(req.auth!.userId).select('+password');
    if (!user) throw ApiError.unauthorized();

    if (input.email && input.email.toLowerCase() !== user.email) {
      const taken = await User.exists({ email: input.email.toLowerCase(), _id: { $ne: user._id } });
      if (taken) throw ApiError.badRequest('The email is already associated with an account');
      user.email = input.email.toLowerCase();
    }

    if (input.usernameUrl && input.usernameUrl !== user.usernameUrl) {
      const clean = input.usernameUrl.trim().replace(/\s+/g, '_');
      const taken = await User.exists({ usernameUrl: clean, _id: { $ne: user._id } });
      if (taken) throw ApiError.badRequest('The username is already associated with an account');
      user.usernameUrl = clean;
    }

    if (input.password) user.password = input.password; // hashed by the pre-save hook
    if (input.name !== undefined) user.name = input.name;
    if (input.surname !== undefined) user.surname = input.surname;
    if (input.bio !== undefined) user.bio = input.bio;
    if (input.birth !== undefined) user.birth = input.birth;
    if (input.country !== undefined) user.country = input.country;
    if (input.gender !== undefined) user.gender = input.gender;
    if (input.footerNameUsername !== undefined) user.footerNameUsername = input.footerNameUsername;
    if (input.profilePictureBorderStatus !== undefined)
      user.profilePictureBorderStatus = input.profilePictureBorderStatus;
    if (input.instagramLink !== undefined) user.instagramLink = input.instagramLink;
    if (input.bankAccount !== undefined) user.bankAccount = input.bankAccount;
    if (input.paypalAccount !== undefined) user.paypalAccount = input.paypalAccount;
    /* InfluencerController:1019 mails every follower when the fee goes UP -- not
       when it drops or stays put. The old price is read before it is replaced. */
    const previousPrice = user.priceOfSubscription ?? 0;
    let priceRose = false;
    if (input.priceOfSubscription !== undefined) {
      priceRose = input.priceOfSubscription > previousPrice;
      user.priceOfSubscription = input.priceOfSubscription;
    }
    if (input.earnings !== undefined) user.earnings = input.earnings;
    if (input.chatToggle !== undefined) user.chatToggle = input.chatToggle;
    if (input.profilePicture) user.profilePicture = input.profilePicture;
    if (input.coverPicture) user.coverPicture = input.coverPicture;
    /* updateCoverColor clears any cover picture first (blade parity) */
    if (input.coverColor) {
      user.coverColor = input.coverColor;
      if (user.coverPicture && !input.coverPicture) user.coverPicture = undefined;
    }

    await user.save();
    if (priceRose) void notifyFollowersOfPriceRise(String(user._id), user.priceOfSubscription ?? 0);
    res.json({
      success: true,
      message: 'Updated successfully',
      data: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        usernameUrl: user.usernameUrl ?? null,
        profilePicture: user.profilePicture ?? null,
        coverColor: user.coverColor,
        verified: user.verified,
        vip: user.vip,
      },
    });
  }),
);

/**
 * add_network — Laravel appends the id/url to the two parallel CSV columns
 * (InfluencerController::add_network). The 3-network cap is enforced in the
 * blade's UI only, so it is not repeated here.
 */
meRouter.post(
  '/networks',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { networkId, url } = z
      .object({ networkId: z.number().int().positive(), url: z.string().max(255) })
      .parse(req.body);
    const user = await User.findById(req.auth!.userId);
    if (!user) throw ApiError.unauthorized();
    user.networks.push(String(networkId));
    user.networkProfileLinks.push(url);
    await user.save();
    res.json({ success: true, message: 'Network added successfully' });
  }),
);

/**
 * update_first_network — reorders so the chosen network leads, carrying its
 * profile link to the front (InfluencerController::update_first_network).
 */
meRouter.patch(
  '/first-network',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { firstNetwork } = z.object({ firstNetwork: z.string().min(1) }).parse(req.body);
    const user = await User.findById(req.auth!.userId);
    if (!user) throw ApiError.unauthorized();

    const index = user.networks.indexOf(firstNetwork);
    if (index === -1) throw ApiError.badRequest('Network not found on this account');

    const networks = [firstNetwork, ...user.networks.filter((n) => n !== firstNetwork)];
    const links = [
      user.networkProfileLinks[index] ?? '',
      ...user.networkProfileLinks.filter((_, i) => i !== index),
    ];
    user.networks = networks;
    user.networkProfileLinks = links;
    await user.save();
    res.json({ success: true, message: 'Network successfully' });
  }),
);

/**
 * Control panel lists — the "My Subscriptions" and "Following" blocks the fan
 * modal renders (footer.blade.php L3385-3467): each shows the counterpart user's
 * avatar + @username with a delete affordance keyed by the relation's own id.
 */
meRouter.get(
  '/control-panel-lists',
  requireAuth,
  asyncHandler(async (req, res) => {
    const [subs, follows] = await Promise.all([
      Subscription.find({ user: req.auth!.userId })
        .populate<{ influencer: { _id: unknown; usernameUrl?: string; profilePicture?: string } }>(
          'influencer',
          'usernameUrl profilePicture',
        )
        .lean(),
      Followership.find({ followerUser: req.auth!.userId })
        .populate<{ followedUser: { _id: unknown; usernameUrl?: string; profilePicture?: string } }>(
          'followedUser',
          'usernameUrl profilePicture',
        )
        .lean(),
    ]);

    res.json({
      success: true,
      data: {
        subscriptions: subs
          .filter((s) => s.influencer)
          .map((s) => ({
            id: String(s._id),
            usernameUrl: s.influencer.usernameUrl ?? '',
            profilePicture: s.influencer.profilePicture ?? null,
          })),
        followerships: follows
          .filter((f) => f.followedUser)
          .map((f) => ({
            id: String(f._id),
            userId: String(f.followedUser._id),
            usernameUrl: f.followedUser.usernameUrl ?? '',
            profilePicture: f.followedUser.profilePicture ?? null,
          })),
      },
    });
  }),
);

/** delete_followership by the followership's own id (control panel trash icon). */
meRouter.delete(
  '/followership/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    await Followership.deleteOne({ _id: req.params.id, followerUser: req.auth!.userId });
    res.json({ success: true, message: 'Followership deleted' });
  }),
);

/**
 * Remove an INCOMING subscriber/follower — the trash icon inside the subscriber-list modal
 * (delete_subscription). Only the profile owner (the influencer / followed user) may delete,
 * so the query is scoped to them.
 */
meRouter.delete(
  '/incoming/:type/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { type, id } = req.params;
    if (type === 'subscription') {
      await Subscription.deleteOne({ _id: id, influencer: req.auth!.userId });
    } else if (type === 'followership') {
      await Followership.deleteOne({ _id: id, followedUser: req.auth!.userId });
    } else {
      throw ApiError.badRequest('Invalid relation type');
    }
    res.json({ success: true, message: 'Removed' });
  }),
);

/** Update one network's profile URL, keyed by the network id (per-network editor). */
meRouter.patch(
  '/networks/:networkId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { url } = z.object({ url: z.string().max(255) }).parse(req.body);
    const user = await User.findById(req.auth!.userId);
    if (!user) throw ApiError.unauthorized();
    const i = user.networks.indexOf(String(req.params.networkId));
    if (i === -1) throw ApiError.badRequest('Network not found on this account');
    user.networkProfileLinks[i] = url;
    user.markModified('networkProfileLinks');
    await user.save();
    res.json({ success: true, message: 'Network url editted successfully' });
  }),
);

/** delete_network — drops a network and its parallel link entry by network id. */
meRouter.delete(
  '/networks/:networkId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.auth!.userId);
    if (!user) throw ApiError.unauthorized();
    const i = user.networks.indexOf(String(req.params.networkId));
    if (i === -1) throw ApiError.badRequest('Network not found on this account');
    user.networks.splice(i, 1);
    user.networkProfileLinks.splice(i, 1);
    await user.save();
    res.json({ success: true, message: 'Network deleted successfully' });
  }),
);

/** request_creater_account — instantly upgrades the account to influencer. */
meRouter.post(
  '/request-creator-account',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.auth!.userId);
    if (!user) throw ApiError.unauthorized();
    user.role = 'influencer';
    await user.save();
    res.json({ success: true, message: 'Congrats, You are creator now.' });
  }),
);

/* ---------- follow / unfollow (free) ---------- */

meRouter.post(
  '/follow/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.params.id === req.auth!.userId) throw ApiError.badRequest('You cannot follow yourself.');
    const target = await User.findById(req.params.id);
    if (!target) throw ApiError.notFound('User not found');
    await Followership.updateOne(
      { followedUser: target._id, followerUser: req.auth!.userId },
      { $setOnInsert: { followedUser: target._id, followerUser: req.auth!.userId } },
      { upsert: true },
    );
    res.json({ success: true, message: 'Followed Successfully' });
  }),
);

/** delete_followership — Laravel deletes by followership id; by target here. */
meRouter.delete(
  '/follow/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    await Followership.deleteOne({ followedUser: req.params.id, followerUser: req.auth!.userId });
    res.json({ success: true, message: 'Unfollowed' });
  }),
);

/** Which of these users does the viewer follow / subscribe to? */
meRouter.post(
  '/relations',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { userIds } = z.object({ userIds: z.array(z.string()).max(200) }).parse(req.body);
    const [follows, subs] = await Promise.all([
      Followership.find({ followerUser: req.auth!.userId, followedUser: { $in: userIds } }, { followedUser: 1 }).lean(),
      Subscription.find({ user: req.auth!.userId, influencer: { $in: userIds } }, { influencer: 1 }).lean(),
    ]);
    res.json({
      success: true,
      data: {
        following: follows.map((f) => String(f.followedUser)),
        subscribed: subs.map((s) => String(s.influencer)),
      },
    });
  }),
);

/** hate_post — mirrors like_dislike_post's twin: hating removes an existing like. */
meRouter.post(
  '/hate/:postId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const post = await Post.findById(req.params.postId);
    if (!post) throw ApiError.notFound('Post not found');

    const existing = await Hate.findOne({ post: post._id, user: req.auth!.userId });
    let status: 'post hated' | 'post unhated';
    if (!existing) {
      await Hate.create({ post: post._id, user: req.auth!.userId, influencer: post.influencer });
      await Like.deleteOne({ post: post._id, user: req.auth!.userId });
      status = 'post hated';
    } else {
      await existing.deleteOne();
      status = 'post unhated';
    }
    const [likeRows, hateRows] = await Promise.all([
      Like.countDocuments({ post: post._id }),
      Hate.countDocuments({ post: post._id }),
    ]);
    res.json({ success: true, data: { status, likesTotal: likeRows + post.noOfLikes, likesCount: likeRows, hatesCount: hateRows } });
  }),
);

/**
 * Feed (user/feed.blade.php) — posts from everyone the viewer subscribes to, then
 * everyone they follow, latest 5 per creator. Each card carries its author (@username,
 * avatar, verified) and a view count (likes table + legacy no_of_likes), exactly like
 * the two blade loops (subscriptions ordered by created_at, followerships by updated_at).
 */
meRouter.get(
  '/feed',
  requireAuth,
  asyncHandler(async (req, res) => {
    const [subs, follows] = await Promise.all([
      Subscription.find({ user: req.auth!.userId }, { influencer: 1 }).lean(),
      Followership.find({ followerUser: req.auth!.userId }, { followedUser: 1 }).lean(),
    ]);

    // Creator groups in blade order: subscriptions first, then followerships.
    const groups: { creatorId: string; sort: 'created' | 'updated' }[] = [
      ...subs.map((s) => ({ creatorId: String(s.influencer), sort: 'created' as const })),
      ...follows.map((f) => ({ creatorId: String(f.followedUser), sort: 'updated' as const })),
    ];

    // Load each creator's latest 5 posts (created_at / updated_at desc) preserving order.
    const grouped = await Promise.all(
      groups.map((g) =>
        Post.find({ influencer: g.creatorId })
          .sort(g.sort === 'created' ? { createdAt: -1 } : { updatedAt: -1 })
          .limit(5)
          .lean(),
      ),
    );

    const allPosts = grouped.flat();
    const postIds = allPosts.map((p) => p._id);
    const creatorIds = [...new Set(groups.map((g) => g.creatorId))];

    /* Batch: like/hate counts per post, the viewer's own votes, and author docs (avoids N
       queries). The rating pill on the feed cards runs on the same numbers the world feed
       and the walls carry. */
    const [likeAgg, hateAgg, myLikes, myHates, authors] = await Promise.all([
      Like.aggregate<{ _id: unknown; count: number }>([
        { $match: { post: { $in: postIds } } },
        { $group: { _id: '$post', count: { $sum: 1 } } },
      ]),
      Hate.aggregate<{ _id: unknown; count: number }>([
        { $match: { post: { $in: postIds } } },
        { $group: { _id: '$post', count: { $sum: 1 } } },
      ]),
      Like.find({ user: req.auth!.userId, post: { $in: postIds } }, { post: 1 }).lean(),
      Hate.find({ user: req.auth!.userId, post: { $in: postIds } }, { post: 1 }).lean(),
      User.find({ _id: { $in: creatorIds } }, { usernameUrl: 1, profilePicture: 1, verified: 1 }).lean(),
    ]);
    const likeByPost = new Map(likeAgg.map((l) => [String(l._id), l.count]));
    const hateByPost = new Map(hateAgg.map((h) => [String(h._id), h.count]));
    const likedSet = new Set(myLikes.map((l) => String(l.post)));
    const hatedSet = new Set(myHates.map((h) => String(h.post)));
    const authorById = new Map(authors.map((a) => [String(a._id), a]));

    const data = groups.flatMap((g, i) => {
      const author = authorById.get(g.creatorId);
      return grouped[i].map((p) => ({
        id: String(p._id),
        imageVideo: p.imageVideo ?? null,
        thumbnail: p.thumbnail ?? null,
        tags: p.tags ?? [],
        taggedProfilePictures: p.taggedProfilePictures ?? [],
        viewsTotal: (likeByPost.get(String(p._id)) ?? 0) + p.noOfLikes,
        likesCount: likeByPost.get(String(p._id)) ?? 0,
        hatesCount: hateByPost.get(String(p._id)) ?? 0,
        likePercent: p.likePercent ?? null,
        viewerLiked: likedSet.has(String(p._id)),
        viewerHated: hatedSet.has(String(p._id)),
        author: {
          id: g.creatorId,
          usernameUrl: author?.usernameUrl ?? null,
          profilePicture: author?.profilePicture ?? null,
          verified: author?.verified ?? false,
        },
      }));
    });

    res.json({ success: true, data });
  }),
);

/** check_duplicate_email / check_duplicate_email_username (used by the forms). */
meRouter.get(
  '/check-duplicate',
  asyncHandler(async (req, res) => {
    const email = typeof req.query.email === 'string' ? req.query.email.toLowerCase() : null;
    const username = typeof req.query.username === 'string' ? req.query.username : null;
    const [emailExists, usernameExists] = await Promise.all([
      email ? User.exists({ email }).then(Boolean) : false,
      username ? User.exists({ usernameUrl: username }).then(Boolean) : false,
    ]);
    res.json({ success: true, data: { emailExists, usernameExists } });
  }),
);

/** Current password check, used before sensitive changes in the control panel. */
meRouter.post(
  '/verify-password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { password } = z.object({ password: z.string().min(1) }).parse(req.body);
    const user = await User.findById(req.auth!.userId).select('+password');
    if (!user) throw ApiError.unauthorized();
    const ok = await bcrypt.compare(password, (user.password as string).replace(/^\$2y\$/, '$2b$'));
    res.json({ success: true, data: { valid: ok } });
  }),
);

/**
 * withdraw_earnings — port of InfluencerController@withdraw_earnings. Enforces the same
 * gates as the withdraw modal (≥ $50 balance, bank + PayPal set, amount ≤ balance),
 * deducts the amount from the balance, and emails the admin the payout request.
 */
meRouter.post(
  '/withdraw-earnings',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { amount } = z.object({ amount: z.coerce.number().positive() }).parse(req.body);
    const user = await User.findById(req.auth!.userId);
    if (!user) throw ApiError.unauthorized();

    const balance = Math.round((user.earnings ?? 0) * 100) / 100;
    if (balance < 50) throw ApiError.badRequest('You need at least $50.00 to withdraw.');
    if (!user.bankAccount || !user.paypalAccount) {
      throw ApiError.badRequest("You can't withdraw money, first update a Payment Method.");
    }
    if (amount > balance) throw ApiError.badRequest('Amount exceeds your available balance.');

    user.earnings = balance - amount;
    await user.save();

    await sendMail(
      ADMIN_PAYOUT_EMAIL,
      'Payment request of influencer',
      renderEmail({
        title: 'An influencer has requested a payout',
        lines: [
          `<b>Username:</b> @${user.usernameUrl}`,
          `<b>Amount:</b> ${amount}`,
          `<b>Bank account:</b> ${user.bankAccount ?? '—'}`,
          `<b>PayPal account:</b> ${user.paypalAccount ?? '—'}`,
        ],
      }),
    ).catch(() => undefined);

    res.json({ success: true, message: 'Payment withdrawal request sent successfully', earnings: user.earnings });
  }),
);

/**
 * Tells every follower that a creator's fee has gone up — InfluencerController:1019.
 *
 * The blade pauses five seconds after each ten mails so the provider is not hit
 * all at once; the same pacing is kept. Run detached from the request, since a
 * creator with many followers would otherwise wait on it.
 */
async function notifyFollowersOfPriceRise(influencerId: string, price: number): Promise<void> {
  const links = await Followership.find({ followerUser: influencerId }, { followedUser: 1 }).lean();
  let sent = 0;
  for (const link of links) {
    const follower = await User.findById(link.followedUser, { name: 1, email: 1 }).lean();
    if (!follower?.email) continue;
    if (sent === 10) {
      await new Promise((r) => setTimeout(r, 5000));
      sent = 0;
    }
    const mail = priceIncrease({ subscriberName: follower.name ?? '', subscriptionPrice: price });
    await sendMail(follower.email, mail.subject, mail.html).catch(() => undefined);
    sent++;
  }
}
