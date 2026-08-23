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
export function likePercent(likes: number, hates: number, seed?: number | null): number | null {
  if (seed == null) {
    const total = likes + hates;
    return total > 0 ? Math.round((likes / total) * 100) : null;
  }
  const seedLikes = (seed / 100) * SEED_VOTES;
  return Math.round(((seedLikes + likes) / (SEED_VOTES + likes + hates)) * 100);
}
