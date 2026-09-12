import { Post } from '../models/Post.js';
import { Presence } from '../models/Presence.js';
import type { IUser } from '../models/User.js';
import type { HydratedDocument } from 'mongoose';

/**
 * How far into a country an account reaches, in the client's own terms.
 *
 * His rule is that a post belongs to the WORLD of the country it was posted from, and that the
 * only way out of that is to go there: "we make travel the people for be famous". The figure
 * below is what that travel has earned, and it is read as a chance per post — his answer (c),
 * not a share of anybody's feed. Seven travellers on 15% do not fill a country's WORLD between
 * them; each of their posts simply has fifteen chances in a hundred of appearing there.
 */

/** The ladder, exactly as the client set it: days in the country, posts made, reach earned. */
export const LADDER: readonly { days: number; posts: number; percent: number }[] = [
  { days: 29, posts: 100, percent: 38 },
  { days: 15, posts: 45, percent: 25 },
  { days: 5, posts: 15, percent: 15 },
];

/** Days in a country before it becomes the account's home. */
export const HOME_DAYS = 38;

/** What a home reached by travelling is worth. A country they are from is worth everything. */
export const NEW_HOME_PERCENT = 74;
export const HOME_PERCENT = 100;

/** The rung earned by a given count of days and posts — 0 when none is reached. */
export function tierFor(days: number, posts: number): number {
  for (const rung of LADDER) {
    if (days >= rung.days && posts >= rung.posts) return rung.percent;
  }
  return 0;
}

/** Days this account has been seen in a country, and posts it made from there. */
export async function effortIn(
  userId: string,
  country: string,
): Promise<{ days: number; posts: number }> {
  const [days, posts] = await Promise.all([
    Presence.countDocuments({ user: userId, country }),
    Post.countDocuments({ influencer: userId, 'place.country': country }).setOptions({
      withMissing: true,
    }),
  ]);
  return { days, posts };
}

/**
 * What share of this account's posts may appear in a country.
 *
 * A country they have ever called home stays at 100 — "the OLD COUNTRY always appear at his
 * 100%" — except the one they hold now if they travelled to it, which the client priced at 74.
 * That a former home outranks the present one is his own arithmetic, not a slip on our side:
 * nobody is meant to lose the audience they came from.
 */
export async function reachIn(
  user: Pick<IUser, 'usual' | 'usualHistory'> & { _id: unknown },
  country: string,
): Promise<number> {
  const history = user.usualHistory ?? [];
  const isCurrentHome = user.usual?.country === country;
  const wasHome = history.some((h) => h.country === country);

  if (wasHome && !isCurrentHome) return HOME_PERCENT;
  if (isCurrentHome) {
    /* the country they started in is theirs outright; one arrived at by travelling is 74 */
    const original = history[0]?.country;
    return original === country ? HOME_PERCENT : NEW_HOME_PERCENT;
  }

  const { days, posts } = await effortIn(String(user._id), country);
  return tierFor(days, posts);
}

/**
 * Works the ladder out for one country and keeps the answer on the account.
 *
 * Called when a day of presence or a post from that country lands — nothing else can change
 * the answer. The feed then reads it without counting anything, which is the point: a pool of
 * three hundred posts would otherwise be six hundred counting queries a page.
 *
 * Returns true when the figure moved.
 */
export async function refreshEarned(
  user: HydratedDocument<IUser>,
  country: string,
): Promise<boolean> {
  const { days, posts } = await effortIn(String(user._id), country);
  const percent = tierFor(days, posts);
  const row = user.earned.find((e) => e.country === country);

  if (!row) {
    if (percent === 0) return false; /* nothing earned yet — no need for a row saying so */
    user.earned.push({ country, percent });
    return true;
  }
  if (row.percent === percent) return false;
  row.percent = percent;
  return true;
}

/** The earned figure already worked out for a country, without touching the database. */
export function earnedIn(user: Pick<IUser, 'earned'>, country: string): number {
  return user.earned?.find((e) => e.country === country)?.percent ?? 0;
}

/**
 * Moves the account's home when the days in another country have earned it.
 *
 * The client asked for 38 — he raised it himself from 29, to keep it clear of the last rung of
 * the ladder. Going back to a country that was already home is not a move and does not append
 * to the history: "if they turn back to his USUAL COUNTRY, the first day changes again to
 * USUAL COUNTRY", so the old entry simply becomes current again.
 *
 * Returns true when something was written.
 */
export async function maybeMoveHome(
  user: HydratedDocument<IUser>,
  country: string,
  region: string | null,
): Promise<boolean> {
  if (user.usual?.country === country) return false;

  /* Coming back to somewhere that was already home takes no time at all — the client was
     explicit: "if they turn back to his USUAL COUNTRY, the first day changes again to USUAL
     COUNTRY". The 38 days are the price of a *new* home, not of returning to an old one. */
  const returning = user.usualHistory.some((h) => h.country === country);
  if (!returning) {
    const days = await Presence.countDocuments({ user: user._id, country });
    if (days < HOME_DAYS) return false;
    user.usualHistory.push({ country, from: new Date() });
  }

  user.usual = { country, region, since: new Date() };
  return true;
}
