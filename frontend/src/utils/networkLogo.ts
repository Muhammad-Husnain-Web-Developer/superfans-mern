/**
 * The client's logo sets, keyed by network name.
 *
 * Two variants of the same artwork arrived from the client:
 *  - `scroll` — the plain logo, for the sidebar's social-network slider
 *  - `card`   — the same logo on the #E4E4E4 grey card, for the tiles on a wall
 *
 * Names come from the socialnetworks collection (and the hardcoded world list),
 * so they are matched loosely: case and punctuation are stripped before lookup.
 * An unknown name returns null and the caller keeps whatever image it had.
 *
 * The filename carries its own extension. The first set was all SVG; the logos that
 * arrived on 5 Oct 2026 (logosSlider.zip — AliExpress, Temu, Vinted, Spotify) are WEBP
 * app icons, and hard-coding `.svg` here would have pointed at files that do not exist.
 */
const FILES: Record<string, string> = {
  tiktok: 'tiktok.svg',
  twitch: 'twitch.svg',
  youtube: 'youtube.svg',
  /* Twitter is X now — the row kept its id so nobody's chosen networks moved, but the
     name, the address and the artwork are all X's (David, 1 Oct 2026). Both spellings
     resolve here so an account that still has the old name on it is not left blank. */
  twitter: 'x.svg',
  x: 'x.svg',
  snapchat: 'snapchat.svg',
  '21buttons': '21-buttons.svg',
  netflix: 'netflix.svg',
  spotify: 'spotify.webp',
  itunes: 'itunes.svg',
  discord: 'discord.svg',
  amazon: 'amazon.svg',
  instagram: 'instagram.svg',
  office: 'office.svg',
  card: 'card.svg',
  /* the four David added on 1 Oct 2026, with their artwork arriving 5 Oct */
  aliexpress: 'aliexpress.webp',
  temu: 'temu.webp',
  vinted: 'vinted.webp',
  whatsapp: 'whatsapp.svg',
};

export type NetworkLogoVariant = 'scroll' | 'card';

export function networkLogo(name: string | null | undefined, variant: NetworkLogoVariant): string | null {
  if (!name) return null;
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const file = FILES[key];
  return file ? `/brand/networks/${variant}/${file}` : null;
}

/** The locked-post tile — blue26.svg replaces the old blue24.png. */
export const LOCKED_POST_IMAGE = '/brand/blue26.svg';
