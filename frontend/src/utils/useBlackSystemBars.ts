import { useEffect } from 'react';

/**
 * The phone's own bars in black while a full-screen viewer is open.
 *
 * David, 15 Oct 2026: "Black Interfaces of Mobile: specially when we put the FULL SCREEN, put
 * it in black (down bar buttons) … exactly like the top bar in Chrome". The page cannot paint
 * those bars itself, but the browser takes their colour from three things it does control:
 *   · `theme-color` — Chrome's status bar and toolbar (yellow #ffc83d for the rest of the app);
 *   · the page's own background — the colour Chrome on Android paints behind its navigation
 *     bar when it draws the page edge to edge;
 *   · `viewport-fit=cover` — which lets the page reach under those bars in the first place.
 * All three are set on entry and put back exactly as they were on the way out, so the rest
 * of the app keeps its yellow bar and white page.
 */
export function useBlackSystemBars(active = true): void {
  useEffect(() => {
    if (!active) return;
    const html = document.documentElement;
    const body = document.body;

    let theme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const createdTheme = !theme;
    if (!theme) {
      theme = document.createElement('meta');
      theme.name = 'theme-color';
      document.head.appendChild(theme);
    }
    const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');

    const before = {
      theme: theme.content,
      viewport: viewport?.content ?? null,
      htmlBg: html.style.backgroundColor,
      bodyBg: body.style.backgroundColor,
    };

    theme.content = '#000000';
    if (viewport && !/viewport-fit/.test(viewport.content)) {
      viewport.content = `${viewport.content}, viewport-fit=cover`;
    }
    html.style.backgroundColor = '#000';
    body.style.backgroundColor = '#000';

    return () => {
      if (createdTheme) theme?.remove();
      else if (theme) theme.content = before.theme;
      if (viewport && before.viewport !== null) viewport.content = before.viewport;
      html.style.backgroundColor = before.htmlBg;
      body.style.backgroundColor = before.bodyBg;
    };
  }, [active]);
}
