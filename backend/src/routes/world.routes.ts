import { Router } from 'express';
import { Types } from 'mongoose';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { optionalAuth } from '../middleware/auth.js';
import { Post } from '../models/Post.js';
import { User } from '../models/User.js';
import { Like } from '../models/Like.js';
import { Hate } from '../models/Hate.js';
import { Followership } from '../models/Followership.js';
import { Ad } from '../models/Ad.js';

export const worldRouter = Router();

const PER_PAGE = 15;
const MAX_FEED_POSTS = 300;
const TIER_NEEDED = 60;
const PER_USER_CAP = 2;
const MIN_POST_LIKES = 1000;
const RECENT_DAYS = 290;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * World discovery feed — exact port of WorldController@world:
 * users bucketed into 5 mutually-exclusive tiers by lifetime post likes
 * (50k/5k/1k/500/1), per tier up to 60 posts, max 2 per creator, posts must be
 * visible, ≥1000 likes, younger than 290 days; pool capped at 300, shuffled,
 * 15 per page, 3 random ads injected after every 6th post.
 * (Laravel regenerates the pool on every request — same here.)
 */
worldRouter.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const currentPage = Math.max(1, Number(req.query.page) || 1);
    const cutoff = new Date(Date.now() - RECENT_DAYS * 24 * 3600 * 1000);

    // === tier assignment (SUM of likes over visible posts of active users) ===
    const usersByViews = await Post.aggregate<{ _id: Types.ObjectId; totalViews: number }>([
      { $match: { visible: true } },
      { $group: { _id: '$influencer', totalViews: { $sum: '$noOfLikes' } } },
      { $match: { totalViews: { $gte: 1000 } } },
      {
        $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' },
      },
      { $match: { 'user.status': 'active' } },
      { $project: { totalViews: 1 } },
    ]);

    const tiers: Types.ObjectId[][] = [[], [], [], [], []];
    for (const u of usersByViews) {
      if (u.totalViews >= 50000) tiers[0].push(u._id);
      else if (u.totalViews >= 5000) tiers[1].push(u._id);
      else if (u.totalViews >= 1000) tiers[2].push(u._id);
      else if (u.totalViews >= 500) tiers[3].push(u._id);
      else tiers[4].push(u._id);
    }

    // === pool building with per-user cap ===
    interface PoolPost {
      _id: Types.ObjectId;
      influencer: Types.ObjectId;
      imageVideo?: string;
      thumbnail?: string;
      noOfLikes: number;
      tags: string[];
      taggedProfilePictures: string[];
      createdAt: Date;
    }
    const pool: PoolPost[] = [];
    const usedPostIds = new Set<string>();
    const userPostCount = new Map<string, number>();

    for (const tierUserIds of tiers) {
      if (tierUserIds.length === 0) continue;
      let collected = 0;
      for (const userId of shuffle(tierUserIds)) {
        if (collected >= TIER_NEEDED || pool.length >= MAX_FEED_POSTS) break;
        const key = String(userId);
        const current = userPostCount.get(key) ?? 0;
        if (current >= PER_USER_CAP) continue;

        const userPosts = await Post.aggregate<PoolPost>([
          {
            $match: {
              influencer: userId,
              visible: true,
              noOfLikes: { $gte: MIN_POST_LIKES },
              createdAt: { $gte: cutoff },
              _id: { $nin: [...usedPostIds].map((id) => new Types.ObjectId(id)) },
            },
          },
          { $sample: { size: PER_USER_CAP - current } },
        ]);

        for (const post of userPosts) {
          if (collected >= TIER_NEEDED || pool.length >= MAX_FEED_POSTS) break;
          pool.push(post);
          usedPostIds.add(String(post._id));
          userPostCount.set(key, (userPostCount.get(key) ?? 0) + 1);
          collected++;
        }
      }
    }

    const shuffledPool = shuffle(pool);
    const pagePosts = shuffledPool.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

    // === enrichment (postUsers, hates, liked, following) ===
    const influencerIds = [...new Set(pagePosts.map((p) => String(p.influencer)))];
    const postIds = pagePosts.map((p) => p._id);

    const [users, hateCounts, likeCounts] = await Promise.all([
      User.find(
        { _id: { $in: influencerIds } },
        { usernameUrl: 1, profilePicture: 1, verified: 1 },
      ).lean(),
      Hate.aggregate<{ _id: Types.ObjectId; cnt: number }>([
        { $match: { post: { $in: postIds } } },
        { $group: { _id: '$post', cnt: { $sum: 1 } } },
      ]),
      Like.aggregate<{ _id: Types.ObjectId; cnt: number }>([
        { $match: { post: { $in: postIds } } },
        { $group: { _id: '$post', cnt: { $sum: 1 } } },
      ]),
    ]);
    const userMap = new Map(users.map((u) => [String(u._id), u]));
    const hatesMap = new Map(hateCounts.map((h) => [String(h._id), h.cnt]));
    const likesMap = new Map(likeCounts.map((l) => [String(l._id), l.cnt]));

    let likedSet = new Set<string>();
    let followingSet = new Set<string>();
    if (req.auth) {
      const [liked, following] = await Promise.all([
        Like.find({ user: req.auth.userId, post: { $in: postIds } }, { post: 1 }).lean(),
        Followership.find(
          { followerUser: req.auth.userId, followedUser: { $in: influencerIds } },
          { followedUser: 1 },
        ).lean(),
      ]);
      likedSet = new Set(liked.map((l) => String(l.post)));
      followingSet = new Set(following.map((f) => String(f.followedUser)));
    }

    // === ads: 3 random active, injected after every 6th post ===
    const ads = await Ad.aggregate<{ _id: Types.ObjectId; media: string; link?: string }>([
      { $match: { status: true } },
      { $sample: { size: 3 } },
      { $project: { media: 1, link: 1 } },
    ]);

    const items: unknown[] = [];
    pagePosts.forEach((post, index) => {
      const owner = userMap.get(String(post.influencer));
      items.push({
        type: 'post',
        id: String(post._id),
        imageVideo: post.imageVideo ?? null,
        thumbnail: post.thumbnail ?? null,
        noOfLikes: post.noOfLikes,
        likesTotal: post.noOfLikes + (likesMap.get(String(post._id)) ?? 0),
        hatesCount: hatesMap.get(String(post._id)) ?? 0,
        tags: post.tags,
        taggedProfilePictures: post.taggedProfilePictures,
        viewerLiked: likedSet.has(String(post._id)),
        influencer: owner
          ? {
              id: String(owner._id),
              usernameUrl: owner.usernameUrl ?? null,
              profilePicture: owner.profilePicture ?? null,
              verified: owner.verified,
              viewerFollowing: followingSet.has(String(owner._id)),
            }
          : null,
      });
      if ((index + 1) % 6 === 0) {
        const adIndex = Math.floor((index + 1) / 6) - 1;
        if (ads[adIndex]) {
          items.push({
            type: 'ad',
            id: `ad_${String(ads[adIndex]._id)}`,
            media: ads[adIndex].media,
            link: ads[adIndex].link ?? '#',
          });
        }
      }
    });

    res.json({
      success: true,
      data: {
        items,
        total: shuffledPool.length,
        perPage: PER_PAGE,
        currentPage,
        lastPage: Math.max(1, Math.ceil(shuffledPool.length / PER_PAGE)),
      },
    });
  }),
);
