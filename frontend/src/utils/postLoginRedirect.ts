/**
 * Where to send someone straight after they authenticate.
 *
 * Port of LoginController::redirectTo(): business accounts go to the ads centre,
 * creators to their creator wall, everyone else to their own wall. Sending them to
 * "/" instead lands them on the logged-out world page.
 */
export function postLoginPath(role: string | null | undefined): string {
  if (role === 'business') return '/super-ads';
  if (role === 'influencer') return '/influencer';
  return '/user';
}
