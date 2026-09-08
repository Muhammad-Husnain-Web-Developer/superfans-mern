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

/**
 * What to put in `<source type>` — and, for a .mov, nothing at all.
 *
 * The blade names it `video/quicktime`, which is what the file honestly is. But a browser
 * reads that attribute as a promise and drops any source it cannot keep: Chrome answers
 * `canPlayType('video/quicktime')` with the empty string, so it skips the source without
 * fetching a byte of it. Measured on one of our own files: `source error`, `currentSrc`
 * empty, the clip never starts — twenty posts whose video simply never played.
 *
 * Left unnamed, the same file loads and plays: what is inside the QuickTime container is
 * ordinary H.264, which Chrome reads once it looks. Safari, which does take .mov at its
 * word, is no worse off — there is only one source, so nothing is being chosen between.
 *
 * `undefined` rather than an empty string: React then leaves the attribute off altogether,
 * and an empty `type=""` is a promise of its own.
 */
export function videoMime(filename: string): string | undefined {
  const ext = filename.split('.').pop()?.toLowerCase() ?? 'mp4';
  if (ext === 'mov') return undefined;
  return `video/${ext}`;
}

/** Media URL — same shape as Laravel's asset('assets/images/...') */
export function assetImage(filename: string): string {
  return `/assets/images/${filename}`;
}

/**
 * The rating pill's percentage.
 *
 * A post is rated by the people who saw it, so the figure is worked out from the one real,
 * organic number the post already carries: its views. A share of viewers would have voted,
 * and most of those who vote like what they see — both drawn per post from the post's own
 * id, so the figure is fixed to that post and never moves between page loads, and no two
 * posts read alike. Real votes are then added to that audience rather than replacing it.
 *
 * This is what makes a big post steady and a small one lively, the way a real platform
 * behaves: 50 dislikes on a post seen 234 million times change nothing, while ten on a post
 * seen 970 times are most of its audience. The figure it replaced treated every post as
 * though exactly 100 people had voted — a 234M-view post and a 500-view one alike — which
 * is what made it read as invented.
 *
 * `seed` is the figure an admin typed. It is not the answer on its own any more; it sets
 * how well liked the post is, and the post's own audience still decides how much weight
 * that carries. Nothing is asked of the admin: a post with views is rated without them.
 *
 * null when there is nothing to state — no views and not one vote. The blade labels that
 * state plain "Liked".
 */
/* Its own id, hashed, is where a post's two figures come from — FNV-1a, for no reason
   beyond being short and well spread. */
function postNoise(id: string, salt: string): number {
  let h = 2166136261;
  const key = id + salt;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/** what share of the people who saw a post would have voted on it */
const ENGAGEMENT_MIN = 0.01;
const ENGAGEMENT_MAX = 0.05;
/** and how well liked it is, before an admin says otherwise */
const LIKED_MIN = 0.72;
const LIKED_MAX = 0.97;
/** past this, a post is steady enough; the cap keeps real votes worth something even on
    the 234M-view post, which would otherwise be immovable */
const IMPLIED_CAP = 5000;
/* a floor, so a post seen a few hundred times is not decided by three people — at 3 a
   970-view post fell 94% -> 27% on ten dislikes, which reads as a glitch rather than a
   verdict */
const IMPLIED_MIN = 10;
/** the old fixed weight, kept only for a post with a typed figure and no views to reason
    from — without it that figure would have nothing to stand on */
const SEED_VOTES = 100;

// export function likePercent(
//   likes: number,
//   hates: number,
//   seed?: number | null,
//   post?: { id?: string | null; views?: number | null },
// ): number | null {
//   const id = post?.id ?? '';
//   const views = post?.views ?? 0;

//   let base = 0;
//   let baseLikes = 0;
//   if (id && views > 0) {
//     const rate = ENGAGEMENT_MIN + postNoise(id, 'r') * (ENGAGEMENT_MAX - ENGAGEMENT_MIN);
//     const liked =
//       seed == null ? LIKED_MIN + postNoise(id, 'l') * (LIKED_MAX - LIKED_MIN) : seed / 100;
//     base = Math.min(IMPLIED_CAP, Math.max(IMPLIED_MIN, Math.round(views * rate)));
//     baseLikes = base * liked;
//   } else if (seed != null) {
//     base = SEED_VOTES;
//     baseLikes = (seed / 100) * SEED_VOTES;
//   }

//   const total = base + likes + hates;
//   if (total === 0) return null;
//   const pct = Math.round(((baseLikes + likes) / total) * 100);
//   if (pct >= 100) return 100;
//   if (pct <= 0) return null;
//   return pct;
// }

export function likePercent(
  likes: number,
  hates: number,
  seed?: number | null,
  post?: { id?: string | null; views?: number | null },
): number | null {
  // ✅ FIX: Agar 0 votes hain → null return (middle bar, "Like" dikhega)
  if (likes === 0 && hates === 0) {
    return null;
  }

  const id = post?.id ?? '';
  const views = post?.views ?? 0;

  let base = 0;
  let baseLikes = 0;
  if (id && views > 0) {
    const rate = ENGAGEMENT_MIN + postNoise(id, 'r') * (ENGAGEMENT_MAX - ENGAGEMENT_MIN);
    const liked =
      seed == null ? LIKED_MIN + postNoise(id, 'l') * (LIKED_MAX - LIKED_MIN) : seed / 100;
    base = Math.min(IMPLIED_CAP, Math.max(IMPLIED_MIN, Math.round(views * rate)));
    baseLikes = base * liked;
  } else if (seed != null) {
    base = SEED_VOTES;
    baseLikes = (seed / 100) * SEED_VOTES;
  }

  const total = base + likes + hates;
  if (total === 0) return null;
  const pct = Math.round(((baseLikes + likes) / total) * 100);
  if (pct >= 100) return 100;
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
