import { Types } from 'mongoose';
import { Ad } from '../models/Ad.js';
import { Post } from '../models/Post.js';
import { notEnded, promotedPostRef } from './ad-tiles.js';

const DAY_MS = 24 * 3600 * 1000;

/**
 * The paid side of an ad's life, run once a minute beside the growth bot (server.ts).
 *
 * 1. The window. An ad goes live when the admin approves it, which can be days after it was
 *    paid for, so the days bought start counting the first minute the ad is seen live rather
 *    than at checkout. Done here rather than in the approve route so that every way of
 *    switching an ad on is covered, the admin panel's toggle included.
 * 2. The views. A promoted post was quoted a number of views on the form (its 👥 estimate);
 *    the bot adds them to the post's 👁️ evenly across the window — David: "This action:
 *    Activate increase the Bot Admin views". Worked out from elapsed time rather than added a
 *    fixed amount a tick, so a missed minute (a restart, a deploy) is made up on the next one
 *    and the total lands exactly on what was quoted.
 * 3. The end. Once the window has passed the ad is switched off. The ad slots and the WORLD
 *    feed also refuse anything past its end, so a late tick never shows an ad too long.
 *
 * Ads with no days on record — every ad from before this existed — have no window and run on
 * as they always have.
 */
export async function runPromotionTick(now = new Date()): Promise<{ started: number; viewed: number; ended: number }> {
  /* 1 — start the clock on anything live that has days but no window yet */
  const unstarted = await Ad.find(
    { status: true, approved: true, campaignDays: { $gt: 0 }, startsAt: null },
    { campaignDays: 1 },
  ).lean();
  for (const ad of unstarted) {
    await Ad.updateOne(
      { _id: ad._id, startsAt: null },
      { $set: { startsAt: now, endsAt: new Date(now.getTime() + (ad.campaignDays ?? 0) * DAY_MS) } },
    );
  }

  /* 2 — the views still owed to each live promoted post */
  const running = await Ad.find(
    {
      adType: 'promote-post',
      status: true,
      boostViews: { $gt: 0 },
      startsAt: { $ne: null },
      endsAt: { $ne: null },
      $expr: { $lt: ['$boostViewsGiven', '$boostViews'] },
    },
    { link: 1, startsAt: 1, endsAt: 1, boostViews: 1, boostViewsGiven: 1 },
  ).lean();
  let viewed = 0;
  for (const ad of running) {
    const start = ad.startsAt!.getTime();
    const span = Math.max(1, ad.endsAt!.getTime() - start);
    const share = Math.min(1, Math.max(0, (now.getTime() - start) / span));
    const due = Math.floor((ad.boostViews ?? 0) * share) - (ad.boostViewsGiven ?? 0);
    if (due <= 0) continue;
    const postId = await resolvePromotedPost(ad.link);
    if (!postId) continue;
    await Post.updateOne({ _id: postId }, { $inc: { noOfViews: due } });
    await Ad.updateOne({ _id: ad._id }, { $inc: { boostViewsGiven: due } });
    viewed++;
  }

  /* 3 — switch off whatever has run its days */
  const ended = await Ad.updateMany({ status: true, endsAt: { $ne: null, $lte: now } }, { $set: { status: false } });

  return { started: unstarted.length, viewed, ended: ended.modifiedCount };
}

/** The post a promote-post ad points at — a new ad's ObjectId or a migrated row's number. */
export async function resolvePromotedPost(link: string | null | undefined): Promise<Types.ObjectId | null> {
  const ref = promotedPostRef(link);
  if (ref.id) return new Types.ObjectId(ref.id);
  if (ref.mysqlId) {
    const p = await Post.findOne({ mysqlId: ref.mysqlId }, { _id: 1 }).setOptions({ withMissing: true }).lean();
    return p?._id ?? null;
  }
  return null;
}

/**
 * The posts bought "As a normal Post" that are live right now — WORLD deals one into each
 * page as an ordinary post (world.routes.ts).
 */
export async function livePromotedPostIds(now = new Date()): Promise<Types.ObjectId[]> {
  const ads = await Ad.find(
    { adType: 'promote-post', promoteAs: 'post', status: true, approved: true, ...notEnded(now) },
    { link: 1 },
  ).lean();
  const ids: Types.ObjectId[] = [];
  for (const ad of ads) {
    const id = await resolvePromotedPost(ad.link);
    if (id && !ids.some((x) => x.equals(id))) ids.push(id);
  }
  return ids;
}
