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

export function businessMayOpen(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  /* "/" is the landing address, which redirects into the World */
  if (segments.length === 0) return false;
  const [first] = segments;
  if (BUSINESS_SEGMENTS.has(first)) return true;
  /* a lone segment the app does not own is a creator's public profile */
  return segments.length === 1 && !APP_SEGMENTS.has(first);
}
