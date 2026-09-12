import type { IUser } from '../models/User.js';
import { ReachLock, type IReachLock, type LockPlace } from '../models/ReachLock.js';
import { HOME_PERCENT, NEW_HOME_PERCENT, earnedIn } from './reach.js';

/** the part of an author the WORLD filter needs — all of it already on the user document */
export type ReachUser = Pick<IUser, 'usual' | 'usualHistory' | 'earned'>;

/** a lock as the filter reads it — ids as strings, since that is how the pool carries them */
export type Lock = Pick<IReachLock, 'kind' | 'from' | 'to' | 'percent'> & { user?: string | null };

/** where a reader is — country, and the region inside it when the address gives one */
export interface ViewerPlace {
  country: string;
  region: string | null;
}

/**
 * What share of an author's posts may appear in one country, read without a single query.
 *
 * Homes are settled from the two lists the account already carries; everything else was worked
 * out when the day or the post that earned it landed. See reach.ts for where those figures come
 * from and for the client's own wording behind each of them.
 */
export function reachPercent(user: ReachUser | null | undefined, country: string): number {
  if (!user) return 0;
  const history = user.usualHistory ?? [];
  const isCurrentHome = user.usual?.country === country;
  const wasHome = history.some((h) => h.country === country);

  if (wasHome && !isCurrentHome) return HOME_PERCENT;
  if (isCurrentHome) return history[0]?.country === country ? HOME_PERCENT : NEW_HOME_PERCENT;
  return earnedIn(user, country);
}

/* ---------- the owner's lockers ---------- */

const LOCKS_TTL_MS = 60_000;
let locksCache: { at: number; locks: Lock[] } | null = null;

/**
 * Every lock the owner has written, read once a minute rather than once a page. There are
 * never more than a handful, and the admin routes drop the copy the moment one changes, so
 * the minute only matters if the table were edited by hand.
 */
export async function currentLocks(): Promise<Lock[]> {
  if (locksCache && Date.now() - locksCache.at < LOCKS_TTL_MS) return locksCache.locks;
  const rows = await ReachLock.find({}, { kind: 1, user: 1, from: 1, to: 1, percent: 1 }).lean();
  const locks: Lock[] = rows.map((r) => ({
    kind: r.kind,
    user: r.user ? String(r.user) : null,
    from: r.from ?? null,
    to: r.to,
    percent: r.percent,
  }));
  locksCache = { at: Date.now(), locks };
  return locks;
}

/** Forget the cached locks — called after the owner writes one. */
export function forgetLocks(): void {
  locksCache = null;
}

/** A rule for the whole country covers every region; one naming a region covers that alone. */
function placeMatches(rule: LockPlace | null | undefined, place: LockPlace | ViewerPlace | null | undefined): boolean {
  if (!rule || !place) return false;
  if (rule.country !== place.country) return false;
  return !rule.region || rule.region === (place.region ?? null);
}

/** how narrowly a rule is drawn — a region on either side counts, so the narrowest rule wins */
function narrowness(lock: Lock): number {
  return (lock.from?.region ? 1 : 0) + (lock.to?.region ? 1 : 0);
}

/**
 * The figure the owner has written for this post and this reader, or null when he has not.
 *
 * A rule about the author outranks a rule about the place — the individual locker exists to
 * make exceptions to the zone one — and between two rules of the same kind the one drawn more
 * narrowly (naming a region) outranks the one for the whole country.
 */
export function lockedPercent(
  locks: readonly Lock[],
  authorId: string,
  postPlace: LockPlace | null | undefined,
  viewer: ViewerPlace,
): number | null {
  let best: Lock | null = null;
  let bestRank = -1;
  for (const lock of locks) {
    if (!placeMatches(lock.to, viewer)) continue;
    if (lock.kind === 'user') {
      if (lock.user !== authorId) continue;
    } else if (!placeMatches(lock.from, postPlace)) {
      continue;
    }
    const rank = (lock.kind === 'user' ? 10 : 0) + narrowness(lock);
    if (rank > bestRank) {
      best = lock;
      bestRank = rank;
    }
  }
  return best ? best.percent : null;
}

/**
 * Whether one post is shown to one reader.
 *
 * A reader we cannot place is shown everything. Where the owner has written a rule for this
 * post and this reader, his figure is the whole answer — it is what the lockers are for.
 *
 * Otherwise: a post with no place is shown everywhere — the client's own answer for the posts
 * that came before any of this, and for anyone whose address we cannot read. A post is always
 * shown in the country it was made in; that is the base rule the whole feature hangs off.
 * Beyond that, the author's reach decides.
 *
 * The client asked for reach to be a chance per post. It is drawn from the post's own id rather
 * than from a die, so the same post is either in that country's WORLD or not, instead of
 * flickering in and out between one page load and the next. Over a body of posts the share
 * shown is the same either way; what changes is that a reader does not watch posts appear and
 * vanish as they scroll.
 */
export function postReachesCountry(
  postId: string,
  authorId: string,
  postPlace: LockPlace | null | undefined,
  author: ReachUser | null | undefined,
  viewer: ViewerPlace | null,
  locks: readonly Lock[] = [],
): boolean {
  if (!viewer) return true; /* we cannot place the reader — show them everything */

  const locked = lockedPercent(locks, authorId, postPlace, viewer);
  if (locked !== null) return chance(postId, viewer.country, locked);

  if (!postPlace) return true;
  if (postPlace.country === viewer.country) return true;
  return chance(postId, viewer.country, reachPercent(author, viewer.country));
}

/** the post's own draw against a figure, the same draw every time it is asked */
function chance(postId: string, country: string, percent: number): boolean {
  if (percent <= 0) return false;
  if (percent >= 100) return true;
  return spread(postId + '|' + country) < percent;
}

/** the post's id spread evenly over 0-99 — FNV-1a, for being short and well scattered */
function spread(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 100;
}
