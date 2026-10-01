/**
 * A business account belongs in the Super Ads Center and nowhere else in the app.
 *
 * The client's rule: if such an account reaches a World page — by typing the address or by
 * following an old link — it is sent straight to /super-ads. The one exception he named is a
 * creator's public profile at /{username}, which anybody may read.
 *
 * The check is on the first segment. Every address the app itself owns is listed here, so a
 * single segment that is NOT in the list can only be a vanity profile.
 */
const APP_SEGMENTS = new Set([
  'world',
  'user',
  'influencer',
  'posts',
  'post',
  'stories',
  'rankings',
  'watch-live',
  'start-stream',
  'super-ads',
  'admin',
  'merchandising',
  'login',
  'register',
  'fan',
  'creador',
  'password',
  'business',
  'logout',
]);

/** the pages a business account may still open: its own centre, and the way in and out */
const BUSINESS_SEGMENTS = new Set([
  'super-ads',
  'business',
  'logout',
  /* the guest auth pages: landing on one is harmless and blocking them would trap a
     half-finished login */
  'login',
  'register',
  'fan',
  'creador',
  'password',
]);

/**
 * The World addresses a business may read.
 *
 * David, 1 Oct 2026: "Now they can Visit a user or navigate only for WORLD." Until then the
 * only World page a business could reach was a creator's vanity URL, `/{username}` — every
 * link the app itself writes uses the canonical route instead (`/user/influencer/<handle>`),
 * so following one bounced them into Super Ads, and `/world` was shut outright. The result
 * was an account locked inside the advertising centre.
 *
 * This opens exactly the two things he named and nothing else: the feed, and the pages that
 * make up visiting someone — their profile, their posts, a post opened from either, and a
 * story. Their own wall, feed, posts manager and messages stay shut, because a business has
 * none of those.
 */
function isVisitableWorldPath(segments: string[]): boolean {
  const [first, second] = segments;

  /* /world */
  if (first === 'world' && segments.length === 1) return true;
  /* /user/world and /influencer/world — the prefixed forms the sidebar links to */
  if ((first === 'user' || first === 'influencer') && second === 'world' && segments.length === 2) {
    return true;
  }
  /* /posts/<handle>, /post/<id>, /stories/<handle> */
  if ((first === 'posts' || first === 'post' || first === 'stories') && segments.length === 2) {
    return true;
  }
  /* /{user|influencer}/{influencer|user|influencer_posts|user_posts|post_detail}/<id>.
     The three-segment test is what keeps `/user` — a fan's own wall — out of this. */
  if ((first === 'user' || first === 'influencer') && segments.length === 3) {
    return ['influencer', 'user', 'influencer_posts', 'user_posts', 'post_detail'].includes(second);
  }
  return false;
}

export function businessMayOpen(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  /* "/" is the landing address, which redirects into the World */
  if (segments.length === 0) return false;
  const [first] = segments;
  if (BUSINESS_SEGMENTS.has(first)) return true;
  if (isVisitableWorldPath(segments)) return true;
  /* a lone segment the app does not own is a creator's public profile */
  return segments.length === 1 && !APP_SEGMENTS.has(first);
}
