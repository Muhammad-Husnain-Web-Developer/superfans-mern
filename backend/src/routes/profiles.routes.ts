import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ApiError } from '../middleware/errors.js';
import { User } from '../models/User.js';
import { Post } from '../models/Post.js';
import { resolveTaggedAvatars } from '../utils/tagged-avatars.js';
import { Like } from '../models/Like.js';
import { Hate } from '../models/Hate.js';
import { Followership } from '../models/Followership.js';
import { Subscription } from '../models/Subscription.js';
import { PremiumAccess } from '../models/PremiumAccess.js';
import { SocialNetwork } from '../models/SocialNetwork.js';
import { UserBlock } from '../models/UserBlock.js';
import { optionalAuth } from '../middleware/auth.js';

export const profilesRouter = Router();

/**
 * Public profile by vanity URL — mirrors Laravel's fallback route
 * (UserController@user_profile): 404 when missing, distinct response for
 * suspended accounts, otherwise profile + latest posts.
 */
profilesRouter.get(
  '/:usernameUrl',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ usernameUrl: req.params.usernameUrl });
    if (!user) throw ApiError.notFound('Profile not found');

    // Blade parity: auth()->user()->hasBlocked($user) / isBlockedBy($user)
    let viewerHasBlocked = false;
    let viewerIsBlockedBy = false;
    let viewerFollowing = false;
    let viewerSubscribed = false;
    /* the blade's `hasPaidInfluencer` — this viewer has bought priority access to this
       creator's inbox, so the ✉️ writes to them even with their chat switched off */
    let viewerPremium = false;
    if (req.auth) {
      [viewerHasBlocked, viewerIsBlockedBy, viewerFollowing, viewerSubscribed, viewerPremium] =
        await Promise.all([
          UserBlock.exists({ blocker: req.auth.userId, blocked: user._id }).then(Boolean),
          UserBlock.exists({ blocker: user._id, blocked: req.auth.userId }).then(Boolean),
          Followership.exists({ followedUser: user._id, followerUser: req.auth.userId }).then(Boolean),
          Subscription.exists({ influencer: user._id, user: req.auth.userId }).then(Boolean),
          PremiumAccess.exists({ influencer: user._id, user: req.auth.userId }).then(Boolean),
        ]);
    }
    if (user.status === 'suspended') {
      res.status(403).json({ success: false, message: 'suspended', data: { status: user.status } });
      return;
    }

    const postsCount = await Post.countDocuments({ influencer: user._id });

    // Stats exactly as the Blade page computes them:
    // followers = users.no_of_followers + followerships + subscriptions
    // likes     = likes on the user's posts + sum(posts.no_of_likes)
    const [followershipCount, subscriptionCount, postIds, likesAgg] = await Promise.all([
      Followership.countDocuments({ followedUser: user._id }),
      Subscription.countDocuments({ influencer: user._id }),
      Post.find({ influencer: user._id }, { _id: 1 }).lean(),
      Post.aggregate<{ _id: null; total: number }>([
        { $match: { influencer: user._id } },
        { $group: { _id: null, total: { $sum: '$noOfLikes' } } },
      ]),
    ]);
    const likeRowCount = await Like.countDocuments({ post: { $in: postIds.map((p) => p._id) } });
    const likesTotal = likeRowCount + (likesAgg[0]?.total ?? 0);
    const followersTotal = user.noOfFollowers + followershipCount + subscriptionCount;

    // Laravel stores network IDs in the CSV column — resolve to name/images/link
    const networkIds = user.networks.map((n) => Number(n)).filter((n) => Number.isFinite(n));
    const networkDocs = await SocialNetwork.find({ mysqlId: { $in: networkIds } }).lean();
    const networkDetails = networkIds
      .map((id, index) => {
        const doc = networkDocs.find((d) => d.mysqlId === id);
        if (!doc) return null;
        return {
          id: doc.mysqlId,
          name: doc.name,
          image: doc.image,
          feedImage: doc.feedImage,
          link: user.networkProfileLinks[index] ?? doc.defaultAddress,
        };
      })
      .filter((n) => n !== null);

    res.json({
      success: true,
      data: {
        id: String(user._id),
        name: user.name,
        surname: user.surname ?? null,
        role: user.role,
        usernameUrl: user.usernameUrl,
        bio: user.bio ?? null,
        profilePicture: user.profilePicture ?? null,
        coverPicture: user.coverPicture ?? null,
        coverColor: user.coverColor,
        verified: user.verified,
        vip: user.vip,
        chatToggle: user.chatToggle,
        noOfFollowers: user.noOfFollowers,
        priceOfSubscription: user.priceOfSubscription ?? null,
        networks: user.networks,
        networkProfileLinks: user.networkProfileLinks,
        networkDetails,
        followersTotal,
        likesTotal,
        viewerHasBlocked,
        viewerIsBlockedBy,
        viewerFollowing,
        viewerSubscribed,
        viewerPremium,
        /* payout details are the owner's own business — never expose them to other viewers */
        ...(req.auth && String(user._id) === req.auth.userId
          ? {
              earnings: user.earnings,
              videoAdsEarnings: user.videoAdsEarnings ?? 0,
              bankAccount: user.bankAccount ?? null,
              paypalAccount: user.paypalAccount ?? null,
            }
          : {}),
        instagramLink: user.instagramLink ?? null,
        footerNameUsername: user.footerNameUsername ?? null,
        profilePictureBorderStatus: user.profilePictureBorderStatus ?? null,
        country: user.country ?? null,
        birth: user.birth ?? null,
        gender: user.gender ?? null,
        categories: user.categories,
        postsCount,
        createdAt: user.createdAt,
      },
    });
  }),
);

/**
 * Subscriber / follower list — the people subscribed to (influencer) or following (user)
 * this profile. Powers #subcriberlistmodal / #followerlistmodal (opened from the "Followers"
 * count). Each row carries the relation id + type so the profile owner can remove it.
 */
profilesRouter.get(
  '/:usernameUrl/subscribers',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const profile = await User.findOne({ usernameUrl: req.params.usernameUrl });
    if (!profile) throw ApiError.notFound('Profile not found');

    const [subs, follows] = await Promise.all([
      Subscription.find({ influencer: profile._id })
        .populate<{ user: { _id: unknown; usernameUrl?: string; profilePicture?: string } }>(
          'user',
          'usernameUrl profilePicture',
        )
        .lean(),
      Followership.find({ followedUser: profile._id })
        .populate<{ followerUser: { _id: unknown; usernameUrl?: string; profilePicture?: string } }>(
          'followerUser',
          'usernameUrl profilePicture',
        )
        .lean(),
    ]);

    const list = [
      ...subs
        .filter((s) => s.user)
        .map((s) => ({
          id: String(s._id),
          type: 'subscription' as const,
          usernameUrl: s.user.usernameUrl ?? '',
          profilePicture: s.user.profilePicture ?? null,
        })),
      ...follows
        .filter((f) => f.followerUser)
        .map((f) => ({
          id: String(f._id),
          type: 'followership' as const,
          usernameUrl: f.followerUser.usernameUrl ?? '',
          profilePicture: f.followerUser.profilePicture ?? null,
        })),
    ];

    res.json({
      success: true,
      data: {
        isOwner: Boolean(req.auth && req.auth.userId === String(profile._id)),
        list,
      },
    });
  }),
);

/** Profile posts (newest first) — mirrors direct_user_posts / influencer_posts. */
profilesRouter.get(
  '/:usernameUrl/posts',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ usernameUrl: req.params.usernameUrl });
    if (!user) throw ApiError.notFound('Profile not found');

    /* createdAt leads: a post made straight in this app carries no mysqlId at all (that field
       exists only on rows migrated from Laravel), and mysqlId first meant every such post sank
       below every migrated one regardless of how recent it actually was — mysqlId now only
       breaks a tie between migrated posts sharing the same timestamp. */
    const posts = await Post.find({ influencer: user._id }).sort({ createdAt: -1, mysqlId: -1 }).lean();
    const taggedAvatars = await resolveTaggedAvatars(posts);

    /* the wall pill needs the real like/hate rows per post, and the viewer's own
       vote, exactly like the world feed builds them */
    const postIds = posts.map((p) => p._id);
    const [likeCounts, hateCounts] = await Promise.all([
      Like.aggregate<{ _id: unknown; cnt: number }>([
        { $match: { post: { $in: postIds } } },
        { $group: { _id: '$post', cnt: { $sum: 1 } } },
      ]),
      Hate.aggregate<{ _id: unknown; cnt: number }>([
        { $match: { post: { $in: postIds } } },
        { $group: { _id: '$post', cnt: { $sum: 1 } } },
      ]),
    ]);
    const likesMap = new Map(likeCounts.map((l) => [String(l._id), l.cnt]));
    const hatesMap = new Map(hateCounts.map((h) => [String(h._id), h.cnt]));

    let likedSet = new Set<string>();
    let hatedSet = new Set<string>();
    if (req.auth) {
      const [liked, hated] = await Promise.all([
        Like.find({ user: req.auth.userId, post: { $in: postIds } }, { post: 1 }).lean(),
        Hate.find({ user: req.auth.userId, post: { $in: postIds } }, { post: 1 }).lean(),
      ]);
      likedSet = new Set(liked.map((l) => String(l.post)));
      hatedSet = new Set(hated.map((h) => String(h.post)));
    }

    res.json({
      success: true,
      data: posts.map((p, i) => ({
        id: String(p._id),
        imageVideo: p.imageVideo ?? null,
        thumbnail: p.thumbnail ?? null,
        noOfLikes: p.noOfLikes,
        likesCount: likesMap.get(String(p._id)) ?? 0,
        hatesCount: hatesMap.get(String(p._id)) ?? 0,
        likePercent: p.likePercent ?? null,
        viewerLiked: likedSet.has(String(p._id)),
        viewerHated: hatedSet.has(String(p._id)),
        visible: p.visible,
        tags: p.tags,
        /* the wall shows the tagged handles too (user/index.blade.php:1675),
           and the avatars beside them come from here */
        taggedProfilePictures: taggedAvatars[i],
        createdAt: p.createdAt,
      })),
    });
  }),
);
