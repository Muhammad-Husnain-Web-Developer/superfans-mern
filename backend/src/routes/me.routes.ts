import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/errors.js';
import { User } from '../models/User.js';
import { broadcast } from '../services/realtime.js';
import { Followership } from '../models/Followership.js';
import { Subscription } from '../models/Subscription.js';
import { Hate } from '../models/Hate.js';
import { sendMail } from '../services/mailer.js';
import { renderEmail } from '../services/emailTemplate.js';
import { priceIncrease } from '../services/adEmails.js';
import { paymentProvider } from '../services/payments/index.js';
import { logger } from '../config/logger.js';

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
  soundEffects: z.boolean().optional(),
  /* ESTADO — the dot beside the @nickname. Laravel has no equivalent; this is the
     client's own (30 Sep 2026). */
  presence: z.enum(['online', 'away', 'disconnected']).optional(),
  /* INTERESTS — the slugs chosen on the screen after registration. Capped at the
     length of the list the screen offers, so a crafted request cannot grow the array
     without bound; the values themselves are only ever read back as slugs. */
  interests: z.array(z.string().max(40)).max(60).optional(),
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
    let priceChanged = false;
    if (input.priceOfSubscription !== undefined) {
      priceRose = input.priceOfSubscription > previousPrice;
      priceChanged = input.priceOfSubscription !== previousPrice;
      user.priceOfSubscription = input.priceOfSubscription;
    }
    if (input.earnings !== undefined) user.earnings = input.earnings;
    if (input.chatToggle !== undefined) user.chatToggle = input.chatToggle;
    if (input.soundEffects !== undefined) user.soundEffects = input.soundEffects;
    if (input.interests !== undefined) user.interests = input.interests;
    const presenceChanged = input.presence !== undefined && input.presence !== user.presence;
    if (input.presence !== undefined) user.presence = input.presence;
    if (input.profilePicture) user.profilePicture = input.profilePicture;
    if (input.coverPicture) user.coverPicture = input.coverPicture;
    /* updateCoverColor clears any cover picture first (blade parity) */
    if (input.coverColor) {
      user.coverColor = input.coverColor;
      if (user.coverPicture && !input.coverPicture) user.coverPicture = undefined;
    }

    await user.save();
    /* ESTADO — tell every open page at once, so the dot the reader just changed turns
       on other people's screens without them reloading. After the save, so nothing is
       announced that did not land. */
    if (presenceChanged) {
      broadcast('presence:changed', { userId: String(user._id), presence: user.presence });
    }
    if (priceRose) void notifySubscribersOfPriceRise(String(user._id), user.priceOfSubscription ?? 0);
    /* David, 16 Sep 2026: every current subscriber moves to the new price too, from their
       next payment — not just new sign-ups. Runs both directions (a price drop should reach
       subscribers too), fire-and-forget so a popular creator's settings save isn't held on
       a run of Stripe calls. */
    if (priceChanged) {
      void syncSubscriberPrices(String(user._id), user.priceOfSubscription ?? 0);
    }
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
        /* the caller hands this whole object to setUser(), which replaces the context's
           user wholesale — so every field the app reads off the session has to be here
           or it is lost until the next /auth/me. */
        chatToggle: user.chatToggle,
        profilePictureBorderStatus: user.profilePictureBorderStatus ?? '0',
        /* echoed back so the caller's setUser() keeps the sound cache in step */
        soundEffects: user.soundEffects !== false,
        /* ESTADO, so the reader's own dot redraws off the same setUser() */
        presence: user.presence ?? 'online',
        interests: user.interests ?? [],
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
    /* same as posts.routes: the eye's figure rides along unchanged, a like never moves it */
    res.json({
      success: true,
      data: {
        status,
        views: post.noOfViews ?? 0,
        likesTotal: likeRows + post.noOfLikes,
        likesCount: likeRows,
        hatesCount: hateRows,
      },
    });
  }),
);

/**
 * Feed (user/feed.blade.php) — posts from everyone the viewer subscribes to, then
 * everyone they follow, latest 5 per creator. Each card carries its author (@username,
 * avatar, verified) and the post's view count, exactly like the two blade loops
 * (subscriptions ordered by created_at, followerships by updated_at).
 */
/** How many posts one page of the feed carries, now that it is one date-ordered list. */
const FEED_POSTS = 60;

meRouter.get(
  '/feed',
  requireAuth,
  asyncHandler(async (req, res) => {
    const [subs, follows] = await Promise.all([
      Subscription.find({ user: req.auth!.userId }, { influencer: 1 }).lean(),
      Followership.find({ followerUser: req.auth!.userId }, { followedUser: 1 }).lean(),
    ]);

    /* Everyone the viewer follows or subscribes to, once each. The blade walked the two
       lists separately and printed five posts per creator, which stacked one creator's
       whole run above another's newer post; the client asked for a single feed in date
       order, so the creators only decide WHICH posts are eligible here. */
    const creatorIds = [
      ...new Set([
        ...subs.map((s) => String(s.influencer)),
        ...follows.map((f) => String(f.followedUser)),
      ]),
    ];

    /* Suspended and deleted accounts drop out here — "Deleted or Suspended users: don't
       appear in WORLD or Rankings" (David), and a feed is no different. The blade filtered
       neither (user/feed.blade.php:1237 and :1535 are bare `where influencer_id`), so this
       is deliberate; the world feed has matched `users.status = 'active'` all along.
       These docs double as the author list below, so the later lookup is gone. */
    const authors = creatorIds.length
      ? await User.find(
          { _id: { $in: creatorIds }, status: 'active' },
          { usernameUrl: 1, profilePicture: 1, verified: 1 },
        ).lean()
      : [];
    const visibleCreatorIds = authors.map((a) => String(a._id));

    /* One list, newest first. FEED_POSTS caps the page the way the per-creator five used
       to cap it — a busy creator can now fill more of it, which is what date order means.
       `visible` is the creator's own eye-slash: the blade left it out of this query, so a
       post its author had switched off still reached every follower's feed (651 of them
       were in that state). Laravel's own world honours it (world.blade `posts.visible = 1`)
       — the feed simply never did. */
    const allPosts = visibleCreatorIds.length
      ? await Post.find({ influencer: { $in: visibleCreatorIds }, visible: true })
          .sort({ createdAt: -1 })
          .limit(FEED_POSTS)
          .lean()
      : [];
    const postIds = allPosts.map((p) => p._id);

    /* Batch: like/hate counts per post, the viewer's own votes, and author docs (avoids N
       queries). The rating pill on the feed cards runs on the same numbers the world feed
       and the walls carry. */
    const [likeAgg, hateAgg, myLikes, myHates] = await Promise.all([
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
    ]);
    const likeByPost = new Map(likeAgg.map((l) => [String(l._id), l.count]));
    const hateByPost = new Map(hateAgg.map((h) => [String(h._id), h.count]));
    const likedSet = new Set(myLikes.map((l) => String(l.post)));
    const hatedSet = new Set(myHates.map((h) => String(h.post)));
    const authorById = new Map(authors.map((a) => [String(a._id), a]));

    const data = allPosts.map((p) => {
      const creatorId = String(p.influencer);
      const author = authorById.get(creatorId);
      return {
        id: String(p._id),
        imageVideo: p.imageVideo ?? null,
        thumbnail: p.thumbnail ?? null,
        tags: p.tags ?? [],
        taggedProfilePictures: p.taggedProfilePictures ?? [],
        /* the eye's own figure, not a like count. This feed was the last screen still
           deriving it from likes, which is why liking here moved the eye even after the
           world feed had stopped doing it. */
        viewsTotal: p.noOfViews ?? 0,
        likesCount: likeByPost.get(String(p._id)) ?? 0,
        hatesCount: hateByPost.get(String(p._id)) ?? 0,
        likePercent: p.likePercent ?? null,
        viewerLiked: likedSet.has(String(p._id)),
        viewerHated: hatedSet.has(String(p._id)),
        author: {
          id: creatorId,
          usernameUrl: author?.usernameUrl ?? null,
          profilePicture: author?.profilePicture ?? null,
          verified: author?.verified ?? false,
        },
      };
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
 * Tells every PAID subscriber that a creator's fee has gone up.
 *
 * Laravel wrote a job for this — `SendEmailPriceIncreaseToSubscribers`, which mails
 * `$influencer->subscribers` (the `subscriptions` table, i.e. actual paying subscribers) —
 * but never dispatches it anywhere. The code that actually runs on the live site
 * (InfluencerController:1019) instead loops the `followerships` table, so in production this
 * mail has only ever reached free followers, never a paying subscriber. David asked (16 Sep
 * 2026) for the email to reach "the client subscriber" specifically, which is what the dead
 * job intended and what belongs beside `syncSubscriberPrices` below — both now walk the same
 * `subscriptions` rows.
 *
 * The five-second pause after each ten mails is the one part of the live Laravel loop worth
 * keeping: the provider is not hit all at once. Run detached from the request, since a
 * creator with many subscribers would otherwise wait on it.
 */
async function notifySubscribersOfPriceRise(influencerId: string, price: number): Promise<void> {
  const subs = await Subscription.find({ influencer: influencerId }, { user: 1 }).lean();
  let sent = 0;
  for (const sub of subs) {
    const subscriber = await User.findById(sub.user, { name: 1, email: 1 }).lean();
    if (!subscriber?.email) continue;
    if (sent === 10) {
      await new Promise((r) => setTimeout(r, 5000));
      sent = 0;
    }
    const mail = priceIncrease({ subscriberName: subscriber.name ?? '', subscriptionPrice: price });
    await sendMail(subscriber.email, mail.subject, mail.html).catch(() => undefined);
    sent++;
  }
}

/**
 * Moves every current paid subscriber of this creator onto their new price, effective at
 * each subscriber's own next renewal — not charged today, and not a fixed calendar date.
 * `updateSubscriptionPrice`'s `proration_behavior: 'none'` is what guarantees no charge or
 * credit happens right now; only the amount the *next* invoice bills changes.
 *
 * A subscriber whose gateway call fails (a card gone, a subscription already cancelled at
 * Stripe but not yet reconciled here, a network blip) is logged and skipped — one failure
 * must not stop the rest of the creator's subscribers from being updated.
 */
async function syncSubscriberPrices(influencerId: string, newAmount: number): Promise<void> {
  if (!paymentProvider.ready) return;
  const subs = await Subscription.find({
    influencer: influencerId,
    status: 'active',
    externalId: { $exists: true, $ne: null },
  });
  const results = await Promise.allSettled(
    subs.map(async (sub) => {
      await paymentProvider.updateSubscriptionPrice(sub.externalId!, newAmount, 'eur');
      sub.amount = newAmount;
      await sub.save();
    }),
  );
  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length) {
    logger.warn(
      { influencerId, failed: failed.length, total: subs.length, errors: failed.map((f) => String((f as PromiseRejectedResult).reason)) },
      'price sync: some subscribers could not be moved to the new price',
    );
  }
}
