import { Router } from 'express';
import { Types } from 'mongoose';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { optionalAuth } from '../middleware/auth.js';
import { Post } from '../models/Post.js';
import { resolveTaggedAvatars } from '../utils/tagged-avatars.js';
import { User } from '../models/User.js';
import { PremiumAccess } from '../models/PremiumAccess.js';
import { Like } from '../models/Like.js';
import { Hate } from '../models/Hate.js';
import { Followership } from '../models/Followership.js';
import { Subscription } from '../models/Subscription.js';
import { Ad } from '../models/Ad.js';
import { currentLocks, postReachesCountry, type ReachUser, type ViewerPlace } from '../utils/worldReach.js';
import { placeFromRequest } from '../utils/geo.js';
import { logger } from '../config/logger.js';

export const worldRouter = Router();

/** buildAd writes `<app>/post/<id>` for the three picker types (promote-post,
    profile-followers, messages); anything else is an outward link and has no post.
    Ads migrated from Laravel carry the MySQL row number there instead — `/post/714` —
    which is resolved against Post.mysqlId rather than left to fail. */
function promotedPostRef(link: string | null | undefined): { id?: string; mysqlId?: number } {
  const href = link ?? '';
  const oid = /\/post\/([a-f0-9]{24})(?:[/?#]|$)/i.exec(href);
  if (oid) return { id: oid[1] };
  const legacy = /\/post\/(\d+)(?:[/?#]|$)/.exec(href);
  return legacy ? { mysqlId: Number(legacy[1]) } : {};
}

const PER_PAGE = 15;
const MAX_FEED_POSTS = 300;
const TIER_NEEDED = 60;
const PER_USER_CAP = 2;
const MIN_POST_LIKES = 1000;
/* Laravel's own window is 290 days (WorldController@world:57, `Carbon::now()->subDays(290)`).
   Widened to 500 at the client's request: the migrated content is nearly all from June 2025,
   so as real time passed the 290-day cutoff walked past it and the wall emptied out — four
   posts on 7 Sep 2026, and one within the month. This is a deliberate deviation from the
   Laravel original, and the only one in this feed. */
const RECENT_DAYS = 500;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * mulberry32 — a small PRNG entirely determined by its seed, so the same seed always walks
 * the same sequence. That is the whole point of it here: it is what lets one reader's pages
 * be a continuation of one another while a different reader, on the very same pool, gets a
 * different wall.
 */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The same Fisher-Yates as above, but drawing from a seed rather than Math.random. */
function shuffleWithSeed<T>(arr: T[], seed: number): T[] {
  const rand = seededRandom(seed);
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface PoolPost {
  _id: Types.ObjectId;
  influencer: Types.ObjectId;
  imageVideo?: string;
  thumbnail?: string;
  noOfLikes: number;
  /* the eye's figure. Kept beside noOfLikes rather than replacing it: noOfLikes still
     decides which posts reach the pool and how creators are tiered, and none of that
     changes. */
  noOfViews?: number;
  likePercent?: number | null;
  tags: string[];
  taggedProfilePictures: string[];
  createdAt: Date;
  place?: { country: string; region?: string | null } | null;
}

/**
 * How long one built pool is handed to every viewer paging through it before a fresh one is
 * drawn. This is what Laravel's own 5-minute `Cache::remember` was meant to do — its cache key
 * baked a fresh random number into itself on every request, so it never once actually served a
 * cached pool, and that flaw carried over here too ("Laravel regenerates the pool on every
 * request — same here"): a later page reran the whole build with a fresh shuffle, so it usually
 * hands back posts the viewer had already scrolled past. The reel's own dedup
 * (worldSequence.ts's appendSteps) then has nothing new to add and stalls — the client's "loops
 * / shows the same posts" report. The wall's own infinite scroll (World.tsx) has no such guard
 * at all and renders the duplicates outright.
 *
 * A real cache — one key, no randomness in it — is what actually gives a paging viewer a stable
 * run: page 2 is what comes after page 1 rather than an unrelated fresh draw, for as long as the
 * pool stays cached. Global rather than per-viewer, matching the client's stated design (the
 * pool "auto-refreshes" on a timer) and because the country rule below is applied downstream,
 * per request, without needing its own copy of the pool.
 */
const POOL_TTL_MS = 5 * 60 * 1000;
let poolCache: { builtAt: number; pool: PoolPost[] } | null = null;

/**
 * Builds the tier-bucketed, per-creator-capped pool from scratch and shuffles it once. Shuffled
 * here, at build time, rather than per request — a later page slices further into this same
 * order instead of a fresh one, which is what keeps a viewer's run stable while the pool is
 * cached below.
 */
async function buildPool(cutoff: Date): Promise<PoolPost[]> {
  // === tier assignment (SUM of likes over visible posts of active users) ===
  const usersByViews = await Post.aggregate<{ _id: Types.ObjectId; totalViews: number }>([
    { $match: { visible: true } },
    { $group: { _id: '$influencer', totalViews: { $sum: '$noOfLikes' } } },
    { $match: { totalViews: { $gte: 1000 } } },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
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

  return shuffle(pool);
}

/**
 * A build already under way, so that the moment the cache lapses is not a moment every
 * request in flight starts its own rebuild.
 *
 * buildPool takes around 125ms and some 70 round trips (one per creator, measured against
 * the migrated data). Those are awaited I/O, so concurrent requests interleave rather than
 * queue: without this, a hundred readers arriving in that 125ms window would each run the
 * whole build — seven thousand queries for one pool. Holding the promise means the first
 * caller does the work and everyone else waits on the same result.
 */
let poolBuild: Promise<PoolPost[]> | null = null;

/**
 * Bumped by invalidateWorldPool. A build carries the generation it started under and only
 * stores its result if that is still the current one — otherwise a suspension landing while
 * a build was already running would be undone by that build finishing a moment later with
 * the author still in it.
 */
let poolGeneration = 0;

/**
 * Drop the cached pool, so the next reader gets one built from the accounts as they stand now.
 *
 * Suspending or deleting an account takes it out of the pool — the build filters creators on
 * `user.status === 'active'`, and a deleted account has no row to match at all. What it could
 * not do on its own was take effect *now*: the wall went on serving the pool built before the
 * change for the rest of its five minutes, so an admin who suspended someone and looked at
 * WORLD still saw their posts, and reported it as the suspension not working. The admin panel
 * calls this instead, which is what makes it immediate without shortening the window for
 * everyone else.
 */
export function invalidateWorldPool(): void {
  poolCache = null;
  poolGeneration++;
}

/** The pool currently on offer — reused for POOL_TTL_MS, rebuilt once that window passes. */
async function currentPool(cutoff: Date): Promise<PoolPost[]> {
  if (poolCache && Date.now() - poolCache.builtAt < POOL_TTL_MS) return poolCache.pool;
  if (!poolBuild) {
    const generation = poolGeneration;
    poolBuild = buildPool(cutoff)
      .then((pool) => {
        /* a pool built before an invalidation is already out of date — hand it to the
           readers waiting on it, but do not let it become the cached one */
        if (generation === poolGeneration) poolCache = { builtAt: Date.now(), pool };
        return pool;
      })
      /* cleared either way: a failed build must not leave every later request awaiting a
         promise that will never resolve again */
      .finally(() => {
        poolBuild = null;
      });
  }
  return poolBuild;
}

/**
 * World discovery feed — exact port of WorldController@world:
 * users bucketed into 5 mutually-exclusive tiers by lifetime post likes
 * (50k/5k/1k/500/1), per tier up to 60 posts, max 2 per creator, posts must be
 * visible, ≥1000 likes, younger than RECENT_DAYS days; pool capped at 300, shuffled,
 * 15 per page, 3 random ads injected after every 6th post.
 * (Laravel's cache never actually holds — see POOL_TTL_MS above for the real one used here.)
 */
/**
 * Which country's WORLD this reader is looking at — and the region, for the owner's lockers.
 *
 * Their last sighting first — it is what the rest of the feature is written in terms of, and a
 * signed-in reader always has one. Otherwise the address in front of us, which is all a guest
 * gives us. Null when neither says anything, and null means "show everything".
 */
async function placeOfViewer(req: Parameters<typeof placeFromRequest>[0]): Promise<ViewerPlace | null> {
  const auth = (req as { auth?: { userId: string } }).auth;
  if (auth?.userId) {
    const me = await User.findById(auth.userId, { current: 1 }).lean();
    if (me?.current?.country) return { country: me.current.country, region: me.current.region ?? null };
  }
  const here = await placeFromRequest(req);
  return here ? { country: here.country, region: here.region } : null;
}

worldRouter.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const currentPage = Math.max(1, Number(req.query.page) || 1);
    const cutoff = new Date(Date.now() - RECENT_DAYS * 24 * 3600 * 1000);

    const pool = await currentPool(cutoff);

    /**
     * The country rule, applied to the pool before it is paged.
     *
     * A post belongs to the WORLD of the country it was made in; an author reaches beyond that
     * only as far as their travelling has earned them. Posts with no place — everything made
     * before any of this existed — are shown everywhere, which is the client's own answer for
     * them, and so the wall does not empty on the day this ships.
     *
     * The reader's own country comes from where they were last seen, or from the address in
     * front of us for someone not signed in. A reader we cannot place is shown everything.
     *
     * None of this may cost the feed. Should any part of it fail — the address database, the
     * lock table, the authors' rows — the rule is simply not applied and the wall is what it
     * was before the rule existed. And if the rule leaves nothing at all, the pool is shown
     * unfiltered: an empty WORLD is the one outcome the client has never asked for, and a
     * reader in a country nobody has reached yet is better served by everything than by
     * nothing. That last fallback is ours, not his, and is here for the sake of the page.
     */
    let reachable = pool;
    try {
      const viewer = await placeOfViewer(req);
      if (viewer) {
        const ids = [...new Set(pool.map((p) => String(p.influencer)))];
        const [rows, locks] = await Promise.all([
          User.find({ _id: { $in: ids } }, { usual: 1, usualHistory: 1, earned: 1 }).lean(),
          currentLocks(),
        ]);
        const authors = new Map(rows.map((r) => [String(r._id), r as ReachUser]));
        const kept = pool.filter((p) =>
          postReachesCountry(
            String(p._id),
            String(p.influencer),
            p.place,
            authors.get(String(p.influencer)),
            viewer,
            locks,
          ),
        );
        if (kept.length > 0) reachable = kept;
      }
    } catch (err) {
      logger.warn({ err }, 'country rule skipped for this WORLD page');
    }

    /**
     * Per-visit ordering.
     *
     * The pool is shared and cached; what differs between readers is the order they walk it
     * in. The client generates one seed per page load and sends it with every page of that
     * visit, so page 2 continues page 1 — reshuffling freshly on each request is precisely
     * what broke pagination before, handing back posts already scrolled past. A different
     * visit brings a different seed and therefore a different wall, which is what the client
     * asked for after the cache made every reader's wall identical.
     *
     * It costs nothing: no extra query, no extra build — the same cached pool, reordered.
     * A request with no usable seed (an older client, a direct call) keeps the pool's own
     * order, which is exactly the behaviour that was here before.
     */
    const seed = Number(req.query.seed);
    const ordered =
      Number.isFinite(seed) && seed !== 0 ? shuffleWithSeed(reachable, seed) : reachable;
    const pagePosts = ordered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

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
    let hatedSet = new Set<string>();
    let followingSet = new Set<string>();
    if (req.auth) {
      const [liked, hated, following] = await Promise.all([
        Like.find({ user: req.auth.userId, post: { $in: postIds } }, { post: 1 }).lean(),
        Hate.find({ user: req.auth.userId, post: { $in: postIds } }, { post: 1 }).lean(),
        Followership.find(
          { followerUser: req.auth.userId, followedUser: { $in: influencerIds } },
          { followedUser: 1 },
        ).lean(),
      ]);
      likedSet = new Set(liked.map((l) => String(l.post)));
      hatedSet = new Set(hated.map((h) => String(h.post)));
      followingSet = new Set(following.map((f) => String(f.followedUser)));
    }

    // === ads: 3 random active, injected after every 6th post ===
    const ads = await Ad.aggregate<{
      _id: Types.ObjectId;
      media: string;
      link?: string;
      adType?: string;
      buttonSize?: string;
      buttonPosition?: string;
      user?: Types.ObjectId;
    }>([
      { $match: { status: true } },
      /* A suspended or deleted advertiser has to leave the wall with everyone else. The
         posts already do — buildPool only draws from active accounts — but the ad tile
         carries the advertiser's @handle, avatar and a Follow/Subscribe button leading to
         a profile that now refuses the visit, so an ad was a way back onto WORLD for an
         account that had been taken off it.
         Most migrated ads have no advertiser on record at all (56 of the 73 active ones
         here), and those are legitimate — the test only drops an ad that names an owner
         who is no longer active, or whose row has gone entirely. */
      { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'owner' } },
      { $match: { $or: [{ user: null }, { 'owner.status': 'active' }] } },
      { $sample: { size: 3 } },
      { $project: { media: 1, link: 1, adType: 1, buttonSize: 1, buttonPosition: 1, user: 1 } },
    ]);

    /* the advertisers behind those ads, for the tiles that lead back into the app */
    const adOwnerIds = ads.map((a) => a.user).filter(Boolean) as Types.ObjectId[];
    const adOwnerDocs = adOwnerIds.length
      ? await User.find(
          { _id: { $in: adOwnerIds } },
          /* role + price say whether this advertiser is followed or subscribed to — a
             `profile-followers` ad's button is Follow on a free account and Subscribe on
             a creator who charges, the same test the profile and the viewer make */
          { usernameUrl: 1, name: 1, profilePicture: 1, chatToggle: 1, role: 1, priceOfSubscription: 1 },
        ).lean()
      : [];
    /* which of these advertisers this viewer has already bought priority access to */
    const adPaidTo = new Set(
      req.auth && adOwnerIds.length
        ? (
            await PremiumAccess.find(
              { user: req.auth.userId, influencer: { $in: adOwnerIds } },
              { influencer: 1 },
            ).lean()
          ).map((r) => String(r.influencer))
        : [],
    );
    /* what this viewer already is to each advertiser, so the tile knows whether to offer
       the button at all */
    const [adFollowed, adSubscribed] = req.auth && adOwnerIds.length
      ? await Promise.all([
          Followership.find(
            { followerUser: req.auth.userId, followedUser: { $in: adOwnerIds } },
            { followedUser: 1 },
          ).lean().then((rows) => new Set(rows.map((r) => String(r.followedUser)))),
          Subscription.find(
            { user: req.auth.userId, influencer: { $in: adOwnerIds } },
            { influencer: 1 },
          ).lean().then((rows) => new Set(rows.map((r) => String(r.influencer)))),
        ])
      : [new Set<string>(), new Set<string>()];

    /* the posts those picker ads promote, the migrated ones looked up by their old row
       number in one query rather than one per ad */
    const adRefs = ads.map((a) => promotedPostRef(a.link));
    const legacyIds = [...new Set(adRefs.map((r) => r.mysqlId).filter((n): n is number => !!n))];
    const legacyMap = new Map<number, string>(
      legacyIds.length
        ? (await Post.find({ mysqlId: { $in: legacyIds } }, { mysqlId: 1 })
            .setOptions({ withMissing: true })
            .lean()).map((d) => [d.mysqlId as number, String(d._id)])
        : [],
    );
    const promotedPostId = (i: number): string | null => {
      const ref = adRefs[i];
      if (ref?.id) return ref.id;
      return ref?.mysqlId ? legacyMap.get(ref.mysqlId) ?? null : null;
    };

    const adOwners = new Map(
      adOwnerDocs.map((u) => [
        String(u._id),
        {
          id: String(u._id),
          usernameUrl: u.usernameUrl ?? null,
          name: u.name ?? null,
          profilePicture: u.profilePicture ?? null,
          chatToggle: u.chatToggle !== false,
          viewerPremium: adPaidTo.has(String(u._id)),
          role: u.role ?? null,
          priceOfSubscription: u.priceOfSubscription ?? null,
          viewerFollowing: adFollowed.has(String(u._id)),
          viewerSubscribed: adSubscribed.has(String(u._id)),
        },
      ]),
    );

    const taggedAvatars = await resolveTaggedAvatars(pagePosts);

    const items: unknown[] = [];
    pagePosts.forEach((post, index) => {
      const owner = userMap.get(String(post.influencer));
      items.push({
        type: 'post',
        id: String(post._id),
        imageVideo: post.imageVideo ?? null,
        thumbnail: post.thumbnail ?? null,
        noOfLikes: post.noOfLikes,
        /* the eye, and what likePercent measures its engagement against (David, 1 Oct 2026).
           `likesTotal` stays beside it, unchanged, for anything still reading the old figure. */
        views: post.noOfViews ?? 0,
        likesTotal: post.noOfLikes + (likesMap.get(String(post._id)) ?? 0),
        /* the pill needs the real rows on their own */
        likesCount: likesMap.get(String(post._id)) ?? 0,
        hatesCount: hatesMap.get(String(post._id)) ?? 0,
        likePercent: post.likePercent ?? null,
        tags: post.tags,
        taggedProfilePictures: taggedAvatars[index],
        viewerLiked: likedSet.has(String(post._id)),
        viewerHated: hatedSet.has(String(post._id)),
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
            /* an old messages ad holds a mailto: to its advertiser; their address is not
               the feed's to publish, and the tile navigates in-app instead */
            link: /^mailto:/i.test(ads[adIndex].link ?? '') ? '' : ads[adIndex].link ?? '#',
            /* the blade branches on the ad's own type here: a clients-form ad draws its
               lead form in the tile rather than a link, so the feed has to say which is
               which and give the plain id the formulary is looked up by */
            adId: String(ads[adIndex]._id),
            adType: ads[adIndex].adType ?? null,
            /* how big the advertiser asked for the button, and where on the creative */
            buttonSize: ads[adIndex].buttonSize ?? 'medium',
            buttonPosition: ads[adIndex].buttonPosition ?? 'bottom',
            /* who the ad belongs to — a Send Card writes to them, and Follow/Subscribe
               lead to their profile */
            advertiser: adOwners.get(String(ads[adIndex].user ?? '')) ?? null,
            /* the post a picker ad promotes. buildAd writes `${APP}/post/<id>` as the
               link for those three types, so the id is already here — the tile opens it
               full screen when the creative itself is clicked. */
            postId: promotedPostId(adIndex),
          });
        }
      }
    });

    res.json({
      success: true,
      data: {
        items,
        total: reachable.length,
        perPage: PER_PAGE,
        currentPage,
        lastPage: Math.max(1, Math.ceil(reachable.length / PER_PAGE)),
      },
    });
  }),
);
