import { Types } from 'mongoose';
import { Ad } from '../models/Ad.js';
import { Post } from '../models/Post.js';
import { User } from '../models/User.js';
import { PremiumAccess } from '../models/PremiumAccess.js';
import { Followership } from '../models/Followership.js';
import { Subscription } from '../models/Subscription.js';

/**
 * The "Super Ads" tile, built once for everywhere it stands.
 *
 * WORLD and the posts wall both draw this tile, and until now each fetched its own: the world
 * route enriched the ad with its advertiser and the post it promotes, while `/ads/random` —
 * what the wall reads — returned the creative and a link and nothing else. So the wall's tile
 * had no advertiser to name and no button to draw, and the double tag and the `outside`
 * button position David asked for (4 Oct 2026) could not have reached it. One builder, so the
 * two surfaces cannot drift again.
 */

/** buildAd writes `<app>/post/<id>` for the three picker types (promote-post,
    profile-followers, messages); anything else is an outward link and has no post.
    Ads migrated from Laravel carry the MySQL row number there instead — `/post/714` —
    which is resolved against Post.mysqlId rather than left to fail. */
export function promotedPostRef(link: string | null | undefined): { id?: string; mysqlId?: number } {
  const href = link ?? '';
  const oid = /\/post\/([a-f0-9]{24})(?:[/?#]|$)/i.exec(href);
  if (oid) return { id: oid[1] };
  const legacy = /\/post\/(\d+)(?:[/?#]|$)/.exec(href);
  return legacy ? { mysqlId: Number(legacy[1]) } : {};
}

interface AdRow {
  _id: Types.ObjectId;
  media: string;
  link?: string;
  adType?: string;
  buttonSize?: string;
  buttonPosition?: string;
  buttonVariant?: string;
  user?: Types.ObjectId;
  showAdvertiserTag?: boolean;
  createdAt?: Date;
}

/** Everything the tile reads off an ad, in the shape `AdCardItem` expects. */
export interface AdTile {
  type: 'ad';
  id: string;
  media: string;
  link: string;
  adId: string;
  adType: string | null;
  buttonSize: string;
  buttonPosition: string;
  buttonVariant: string | null;
  showAdvertiserTag: boolean;
  createdAt: Date | null;
  advertiser: unknown;
  postId: string | null;
}

/** `count` random active ads, in the order they came out of the sample. */
export async function sampleAds(count: number): Promise<AdRow[]> {
  return Ad.aggregate<AdRow>([
    { $match: { status: true } },
    /* A suspended or deleted advertiser has to leave the wall with everyone else. The posts
       already do — buildPool only draws from active accounts — but the ad tile carries the
       advertiser's @handle, avatar and a Follow/Subscribe button leading to a profile that
       now refuses the visit, so an ad was a way back onto WORLD for an account that had
       been taken off it.
       Most migrated ads have no advertiser on record at all (56 of the 73 active ones here),
       and those are legitimate — the test only drops an ad that names an owner who is no
       longer active, or whose row has gone entirely. */
    { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'owner' } },
    { $match: { $or: [{ user: null }, { 'owner.status': 'active' }] } },
    { $sample: { size: count } },
    /* `createdAt` is the date under the advertiser's name in the full-screen bottom bar,
       `showAdvertiserTag` whether the tile carries their logo beside "Super Ads". */
    {
      $project: {
        media: 1, link: 1, adType: 1, buttonSize: 1, buttonPosition: 1, buttonVariant: 1, user: 1,
        showAdvertiserTag: 1, createdAt: 1,
      },
    },
  ]);
}

/**
 * Turns sampled ads into tiles: the advertiser behind each one, what this viewer already is
 * to them, and the post a picker ad promotes. One query per concern, never one per ad.
 */
export async function buildAdTiles(ads: AdRow[], viewerId?: string | null): Promise<AdTile[]> {
  if (ads.length === 0) return [];

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
    viewerId && adOwnerIds.length
      ? (
          await PremiumAccess.find(
            { user: viewerId, influencer: { $in: adOwnerIds } },
            { influencer: 1 },
          ).lean()
        ).map((r) => String(r.influencer))
      : [],
  );

  /* what this viewer already is to each advertiser, so the tile knows whether to offer
     the button at all */
  const [adFollowed, adSubscribed] = viewerId && adOwnerIds.length
    ? await Promise.all([
        Followership.find(
          { followerUser: viewerId, followedUser: { $in: adOwnerIds } },
          { followedUser: 1 },
        ).lean().then((rows) => new Set(rows.map((r) => String(r.followedUser)))),
        Subscription.find(
          { user: viewerId, influencer: { $in: adOwnerIds } },
          { influencer: 1 },
        ).lean().then((rows) => new Set(rows.map((r) => String(r.influencer)))),
      ])
    : [new Set<string>(), new Set<string>()];

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

  return ads.map((ad, i) => {
    const ref = adRefs[i];
    return {
      type: 'ad' as const,
      id: `ad_${String(ad._id)}`,
      media: ad.media,
      /* an old messages ad holds a mailto: to its advertiser; their address is not the
         feed's to publish, and the tile navigates in-app instead */
      link: /^mailto:/i.test(ad.link ?? '') ? '' : ad.link ?? '#',
      /* the blade branches on the ad's own type here: a clients-form ad draws its lead
         form in the tile rather than a link, so the feed has to say which is which and
         give the plain id the formulary is looked up by */
      adId: String(ad._id),
      adType: ad.adType ?? null,
      /* how big the advertiser asked for the button, and where on the creative */
      buttonSize: ad.buttonSize ?? 'medium',
      buttonPosition: ad.buttonPosition ?? 'bottom',
      /* which design of the type's button, where the advertiser had a choice */
      buttonVariant: ad.buttonVariant ?? null,
      /* the double tag, and the date it carries in the full-screen bottom bar */
      showAdvertiserTag: ad.showAdvertiserTag === true,
      createdAt: ad.createdAt ?? null,
      /* who the ad belongs to — a Send Card writes to them, and Follow/Subscribe lead to
         their profile */
      advertiser: adOwners.get(String(ad.user ?? '')) ?? null,
      /* the post a picker ad promotes. buildAd writes `${APP}/post/<id>` as the link for
         those three types, so the id is already here — the tile opens it full screen when
         the creative itself is clicked. */
      postId: ref?.id ?? (ref?.mysqlId ? legacyMap.get(ref.mysqlId) ?? null : null),
    };
  });
}
