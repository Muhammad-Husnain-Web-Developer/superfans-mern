/**
 * The client's SVG logo sets, keyed by network name.
 *
 * Two variants of the same artwork arrived from the client:
 *  - `scroll` — the plain logo, for the sidebar's social-network slider
 *  - `card`   — the same logo on the #E4E4E4 grey card, for the tiles on a wall
 *
 * Names come from the socialnetworks collection (and the hardcoded world list),
 * so they are matched loosely: case and punctuation are stripped before lookup.
 * An unknown name returns null and the caller keeps whatever image it had.
 */
const FILES: Record<string, string> = {
  tiktok: 'tiktok',
  twitch: 'twitch',
  youtube: 'youtube',
  twitter: 'twitter',
  x: 'x',
  snapchat: 'snapchat',
  '21buttons': '21-buttons',
  netflix: 'netflix',
  spotify: 'spotify',
  itunes: 'itunes',
  discord: 'discord',
  amazon: 'amazon',
  instagram: 'instagram',
  office: 'office',
  card: 'card',
};

export type NetworkLogoVariant = 'scroll' | 'card';

export function networkLogo(name: string | null | undefined, variant: NetworkLogoVariant): string | null {
  if (!name) return null;
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const file = FILES[key];
  return file ? `/brand/networks/${variant}/${file}.svg` : null;
}

/** The locked-post tile — blue26.svg replaces the old blue24.png. */
export const LOCKED_POST_IMAGE = '/brand/blue26.svg';
