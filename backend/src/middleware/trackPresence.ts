import type { NextFunction, Request, Response } from 'express';
import { User } from '../models/User.js';
import { ACCESS_COOKIE, verifyAccessToken } from '../utils/jwt.js';
import { clientIp, placeFromIp } from '../utils/geo.js';
import { Presence, utcDay } from '../models/Presence.js';
import { maybeMoveHome, refreshEarned } from '../utils/reach.js';

/**
 * Keeps `user.current` pointing at wherever the account was last opened from.
 *
 * The client asked for this to be read quietly off the address rather than asked for:
 * "we detect it silently by IP". It sits in front of the whole API rather than on any one
 * route, because the answer is wanted from whatever the reader happens to open first.
 *
 * Two things keep it cheap. Nothing is written unless the place has actually changed or the
 * last sighting has gone stale, and the write is never waited on — a reader should not spend
 * a round trip to the database on bookkeeping that is not part of their answer. A failure
 * here is swallowed for the same reason: losing one sighting is not worth failing a request
 * the reader did ask for.
 */

/** how long a sighting stands before the same place is worth recording again */
const SIGHTING_TTL_MS = 30 * 60 * 1000;

/**
 * Last time this process looked, keyed by the account *and the address it came from*.
 *
 * Keying on the account alone was wrong: a reader who landed in another country was then
 * ignored for the rest of the half hour, so their arrival — the very thing this exists to
 * catch — went unrecorded. Keyed this way a new address is looked at at once, while a burst
 * from the address already known still writes only once.
 */
const lastChecked = new Map<string, number>();
/** the map is per-process and would otherwise grow with every account ever seen */
const MAX_TRACKED = 20_000;

export function trackPresence(req: Request, _res: Response, next: NextFunction): void {
  /* straight past the whole thing for anything that is not a reader's own request */
  const token = (req.cookies as Record<string, string | undefined>)[ACCESS_COOKIE];
  if (!token) return next();

  let userId: string;
  try {
    userId = verifyAccessToken(token).sub;
  } catch {
    return next(); /* expired or forged — a guest as far as this is concerned */
  }

  const ip = clientIp(req);
  if (!ip) return next(); /* localhost or a private network — it says nothing about a country */

  const now = Date.now();
  const key = `${userId}|${ip}`;
  const seen = lastChecked.get(key);
  if (seen !== undefined && now - seen < SIGHTING_TTL_MS) return next();
  if (lastChecked.size >= MAX_TRACKED) lastChecked.clear();
  lastChecked.set(key, now);

  void record(ip, userId).catch(() => undefined);
  next();
}

async function record(ip: string, userId: string): Promise<void> {
  const place = await placeFromIp(ip);
  if (!place) return; /* an address the data has nothing for */

  /* Today, in this country, noted before anything else can return early — the ladder counts
     these rows and a day missed here is a day the reader worked for and did not get. The
     unique index makes every sighting after the first one today a no-op, so this costs one
     rejected insert rather than a read. */
  await Presence.updateOne(
    { user: userId, country: place.country, day: utcDay() },
    { $setOnInsert: { region: place.region } },
    { upsert: true },
  ).catch(() => undefined);

  /* usualHistory is read and written below, so it has to be fetched — left out of the
     projection it arrives undefined and the push throws into the void this runs in */
  const user = await User.findById(userId, {
    current: 1,
    usual: 1,
    usualHistory: 1,
    earned: 1,
    visitedCountries: 1,
  });
  if (!user) return;

  /* a day just landed, so the rung they stand on in this country may have moved */
  let dirty = await refreshEarned(user, place.country);

  /* The home move is asked about on every sighting, not only when the place changed: somebody
     sitting still in another country is exactly who earns a new home, and an earlier version
     of this returned below before ever reaching it. It costs nothing where they are already
     home, which is the common case. */
  if (!user.usual?.country) {
    /* Their first sighting settles a usual country, since nothing else has. A starting guess,
       not a verdict: the 38-day rule properly moves it, and until then this is better than an
       account with no country at all — which is what all but 62 of them are. */
    user.usual = { country: place.country, region: place.region, since: new Date() };
    user.usualHistory.push({ country: place.country, from: new Date() });
    dirty = true;
  } else if (await maybeMoveHome(user, place.country, place.region)) {
    dirty = true;
  }

  /* `current` follows them at once, but is only written when it would say something new or
     when the last sighting has gone stale — otherwise every request would be a write. */
  const current = user.current;
  const moved = current?.country !== place.country || current?.region !== place.region;
  const stale = !current?.seenAt || Date.now() - current.seenAt.getTime() >= SIGHTING_TTL_MS;
  if (moved || stale) {
    user.current = { ...place, seenAt: new Date() };
    dirty = true;
  }

  /* every country this account has ever been seen in, kept whatever `usual` does */
  if (!user.visitedCountries.includes(place.country)) {
    user.visitedCountries.push(place.country);
    dirty = true;
  }

  if (!dirty) return;
  await user.save();
}
