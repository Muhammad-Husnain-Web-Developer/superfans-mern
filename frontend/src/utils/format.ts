/**
 * Exact port of the blade helper `thousandsCurrencyFormat($num)`
 * (user_profile.blade.php ~3693) used for the profile stats:
 *
 *   if ($num > 1000) { number_format → split on ',' → first group +
 *                      '.' + first digit of the next group (dropped when 0)
 *                      + ['k','m','b','t'][groups-1] }
 *
 * Note the LOWERCASE suffix and that it truncates (does not round) the decimal:
 * 12,200,000 → "12.2m" · 2,200,000,000 → "2.2b" · 950 → "950".
 */
export function formatNumber(num: number): string {
  if (num > 1000) {
    const x = Math.round(num);
    const xNumberFormat = x.toLocaleString('en-US');
    const xArray = xNumberFormat.split(',');
    const xParts = ['K', 'M', 'B', 'T'];
    const xCountParts = xArray.length - 1;
    const nextDigit = parseInt(xArray[1][0], 10);
    const xDisplay = xArray[0] + (nextDigit !== 0 ? `.${xArray[1][0]}` : '') + xParts[xCountParts - 1];
    return xDisplay;
  }
  return String(num);
}

/**
 * Exact port of the blade helper `format_number($number)` used on post tiles —
 * this one ROUNDS and uses UPPERCASE suffixes: 1,760,000 → "1.8M", 3,200 → "3.2K".
 */
export function formatNumberRounded(num: number): string {
  if (num >= 1000 && num < 1000000) {
    const v = Math.round((num / 1000) * 10) / 10;
    return `${v}K`;
  }
  if (num >= 1000000) {
    const v = Math.round((num / 1000000) * 10) / 10;
    return `${v}M`;
  }
  return String(num);
}

const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov'];

export function isVideoFile(filename: string | null): boolean {
  if (!filename) return false;
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return VIDEO_EXTENSIONS.includes(ext);
}

/** `<source type>` from the file extension (Laravel maps .mov → video/quicktime). */
export function videoMime(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? 'mp4';
  return `video/${ext === 'mov' ? 'quicktime' : ext}`;
}

/** Media URL — same shape as Laravel's asset('assets/images/...') */
export function assetImage(filename: string): string {
  return `/assets/images/${filename}`;
}

/**
 * The rating pill's percentage. `seed` is the figure an admin typed on the post: it stands
 * alone while nobody has voted, and keeps the weight of SEED_VOTES votes afterwards, so the
 * first real clicks only nudge the number and a post that truly gets voted on drifts to its
 * own ratio. Without a seed the pill is the plain like/hate split.
 *
 * null when there is nothing to state — no typed figure and not one vote either. The blade
 * labels that state plain "Liked", and most migrated posts are in it, so a hard 0% would be
 * on nearly every card.
 */
const SEED_VOTES = 100;
/**
 * The client's rule: a post is never shown as fully liked, and never as fully hated either
 * — "antifake" at the top, "anti-depression" at the bottom, in his words. A pill that works
 * out at 100 or at 0 is shown as these instead, whether the figure came from an admin or
 * from real votes that happen to be one-sided.
 */
// const NEVER_FULL = 93;
// const NEVER_EMPTY = 10;
// export function likePercent(likes: number, hates: number, seed?: number | null): number | null {
//   let pct: number;
//   if (seed == null) {
//     const total = likes + hates;
//     if (total === 0) return null;
//     pct = Math.round((likes / total) * 100);
//   } else {
//     const seedLikes = (seed / 100) * SEED_VOTES;
//     pct = Math.round(((seedLikes + likes) / (SEED_VOTES + likes + hates)) * 100);
//   }
//   if (pct >= 100) return NEVER_FULL;
//   if (pct <= 0) return NEVER_EMPTY;
//   return pct;
// }
export function likePercent(likes: number, hates: number, seed?: number | null): number | null {
  let pct: number;
  if (seed == null) {
    const total = likes + hates;
    if (total === 0) return null;
    pct = Math.round((likes / total) * 100);
  } else {
    const seedLikes = (seed / 100) * SEED_VOTES;
    pct = Math.round(((seedLikes + likes) / (SEED_VOTES + likes + hates)) * 100);
  }
  // Show actual 100% instead of clamping to 93%
  if (pct >= 100) return 100;
  // Show "Like" text instead of showing 0% or 10%
  if (pct <= 0) return null;
  return pct;
}
/**
 * The bar behind the number moves in four steps rather than following the figure exactly —
 * the client's "4 levels of bar: 25, 50, 75, 100". The number itself stays true (83% reads
 * 83% while the bar stands at 75), so the reading is honest and only the drawing is coarse.
 */
export function likeLevel(pct: number | null): 25 | 50 | 75 | 100 {
  if (pct === null) return 50;
  if (pct < 38) return 25;
  if (pct < 63) return 50;
  if (pct < 88) return 75;
  return 100;
}

/**
 * How far the red is drawn for each of the four levels.
 *
 * Not the level itself: at 100 a plain fill runs into the pill's rounded end and the slanted
 * divider disappears into it, and the "Hate" label loses the dark ground it is written on.
 * These stop short of that, so the slant is visible at every level and the two labels always
 * sit on their own colour. The middle one is a true half — the client asked for 50/50 before
 * anybody has voted, which is the level a post with no votes carries.
 */
export function likeFill(level: 25 | 50 | 75 | 100): number {
  switch (level) {
    case 25:
      return 30;
    case 50:
      return 50;
    case 75:
      return 64;
    default:
      /* the top mark stops short of the "Hate" label so that word keeps the dark ground it
         is written on, and the slant stays clear of the pill's rounded end */
      return 76;
  }
}
