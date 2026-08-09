import { useEffect } from 'react';

/**
 * Some blades are standalone pages (rankings/index.blade.php, the auth pages):
 * they do NOT include the layout stylesheets and instead load **Bootstrap 4 from
 * the CDN** plus their own fonts. Our index.html loads the layout CSS globally
 * (local bootstrap.css is Bootstrap 3.3.5 — it even sets `html { font-size: 10px }`),
 * so a standalone page must swap them while it is mounted.
 *
 * Notes:
 * - Disabling via `link.disabled = true` is unreliable when the sheet is still
 *   loading (Chrome keeps applying it), so we switch `media` to `not all`.
 * - The extra sheets are inserted at the START of <head> so the page's own CSS
 *   (bundled after) still wins — exactly the order the blade has them in.
 */
export function useStandalonePageStyles(extraCss: string[], disableLayoutCss = true) {
  useEffect(() => {
    const layoutLinks = disableLayoutCss
      ? Array.from(document.querySelectorAll<HTMLLinkElement>('link[data-layout-css]'))
      : [];
    const previousMedia = layoutLinks.map((l) => l.media);
    layoutLinks.forEach((l) => {
      l.media = 'not all';
    });

    const added = [...extraCss].reverse().map((href) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.dataset.standaloneCss = 'true';
      document.head.insertBefore(link, document.head.firstChild);
      return link;
    });

    return () => {
      layoutLinks.forEach((l, i) => {
        l.media = previousMedia[i] || 'all';
      });
      added.forEach((l) => l.remove());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/**
 * Loads the extracted layouts_direct_user stylesheet for the pages that actually
 * use that layout (profile, posts, world, feed…).
 *
 * It must NOT be a plain `import './layout-direct-user.css'`: Vite bundles imported
 * CSS into one global sheet, so its rules would leak onto the standalone pages too —
 * that is how `#sendlogin { color: red }` ended up recolouring the login button, a
 * page which in Laravel never loads this stylesheet at all.
 */
export function useLayoutPageStyles(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const href = '/page-css/layout-direct-user.css';
    let link = document.querySelector<HTMLLinkElement>(`link[data-page-css="${href}"]`);
    const created = !link;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.dataset.pageCss = href;
      document.head.appendChild(link);
    }
    const el = link;
    return () => {
      if (created) el.remove();
    };
  }, [enabled]);
}

/** Bootstrap 4.0.0 CDN — the exact build the standalone blades link. */
export const BOOTSTRAP4_CDN = 'https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css';
/** Google fonts the rankings blade loads. */
export const RANKINGS_FONTS =
  'https://fonts.googleapis.com/css2?family=Anton&family=BBH+Sans+Bogle&display=swap';
