import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { User } from '../models/User.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { usernameUrlMatch } from '../utils/username.js';

/**
 * Server-rendered Open Graph tags, for link-preview crawlers only (WhatsApp, Facebook,
 * Twitter, Slack, Discord, Telegram, …). They fetch a URL and read whatever meta tags are
 * already in the raw HTML — they do not run this app's JavaScript — so the plain SPA shell
 * they would otherwise receive carries no image at all, for any page, including a creator's
 * own profile. David caught this sharing @ellaesari's profile link on WhatsApp: the preview
 * card showed no photo.
 *
 * nginx sends only requests with a crawler user-agent here (see nginx.conf.example); every
 * browser keeps receiving the built SPA straight off disk, unchanged. This mirrors what
 * Laravel already did per-request — user_profile.blade.php filling `og_image` with
 * `$user->profile_picture`, layouts_direct_user/main.blade.php's site-wide default otherwise
 * — so it is a port of existing behaviour, not a new feature.
 */

const BRAND = 'Superworld';
const SITE_DESCRIPTION = 'Superworld — Connect with your favourite creators';
/* Laravel's own site-wide fallback is assets/images/default-og.jpg, which does not exist on
   disk in either project (checked) — it has always been a broken image there. The per-profile
   fallback logo does exist, so it doubles as the site-wide default here too. */
const DEFAULT_IMAGE_PATH = '/assets/images/logosmall/pwa-app-logo.png';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function absoluteUrl(imagePath: string): string {
  return imagePath.startsWith('http') ? imagePath : `${env.PUBLIC_APP_URL}${imagePath}`;
}

/* The built index.html is read once and cached; a stale copy across a deploy only matters
   until the next restart, same as every other in-memory cache in this app. */
let cachedTemplate: string | null = null;
function loadTemplate(): string | null {
  if (cachedTemplate) return cachedTemplate;
  const distPath = path.resolve(process.cwd(), '..', 'frontend', 'dist', 'index.html');
  try {
    cachedTemplate = fs.readFileSync(distPath, 'utf8');
    return cachedTemplate;
  } catch (err) {
    logger.error({ err, distPath }, 'og-preview: could not read frontend/dist/index.html');
    return null;
  }
}

interface OgTags {
  title: string;
  description: string;
  image: string;
  url: string;
}

function renderHtml(template: string, tags: OgTags): string {
  const title = escapeHtml(tags.title);
  const description = escapeHtml(tags.description);
  const image = escapeHtml(absoluteUrl(tags.image));
  const url = escapeHtml(tags.url);

  const head = `
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:url" content="${url}">
    <meta property="og:site_name" content="${escapeHtml(BRAND)}">
    <meta property="og:image" content="${image}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${image}">
  </head>`;

  return template
    .replace(/<title>.*?<\/title>/i, `<title>${title}</title>`)
    .replace('</head>', head);
}

export const ogRouter = Router();

/**
 * Matches every path except /api and /assets (nginx only forwards crawler user-agents here
 * to begin with, but this guard keeps a misconfigured proxy from ever shadowing the real
 * API or media routes).
 */
ogRouter.get(/^\/(?!api\/|assets\/).*/, async (req, res, next) => {
  try {
    const template = loadTemplate();
    if (!template) return next();

    const requestUrl = `${env.PUBLIC_APP_URL}${req.originalUrl}`;
    const segment = req.path.replace(/^\/+/, '').split('/')[0] ?? '';

    const user = segment ? await User.findOne({ usernameUrl: usernameUrlMatch(decodeURIComponent(segment)) }).lean() : null;

    const tags: OgTags = user
      ? {
          title: user.usernameUrl ?? segment,
          description: user.bio || user.usernameUrl || segment,
          image: user.profilePicture ? `/assets/images/${user.profilePicture}` : DEFAULT_IMAGE_PATH,
          url: requestUrl,
        }
      : {
          title: `${BRAND} | World`,
          description: SITE_DESCRIPTION,
          image: DEFAULT_IMAGE_PATH,
          url: requestUrl,
        };

    res.set('Content-Type', 'text/html; charset=utf-8').send(renderHtml(template, tags));
  } catch (err) {
    next(err);
  }
});
