/**
 * Keeps a randomised feed still while the reader steps away from it.
 *
 * The world pool is reshuffled on every request (world.routes.ts:114, and the
 * blade does the same with a fresh rand() seed), so coming back from a post
 * dealt a different set of posts. Restoring the scroll offset then landed the
 * reader beside something they had never seen. The client asked for the feed to
 * stay exactly as it was on the way back, and to reshuffle only when the World
 * link is clicked or the page is reloaded.
 *
 * The return leg is recognised by a mark left at the moment the reader leaves,
 * not by the navigation type: react-router reports POP for a first render too,
 * so a freshly opened URL is indistinguishable from a back step by that alone.
 * A mark is only ever left by an in-app departure, and reading it consumes it,
 * which leaves every other way of arriving -- typing the URL, clicking World,
 * reloading -- to deal a new hand.
 */
export interface RememberedFeed<T> {
  items: T[];
  page: number;
  lastPage: number;
}

/* ~15 posts a page; this holds a long session's scrolling and stays far inside
   the 5MB sessionStorage budget */
const MAX_ITEMS = 300;

const feedKey = (pathname: string) => `feed:${pathname}`;
const markKey = (pathname: string) => `feed:${pathname}:return`;

/** Leaving the feed for a post or a profile — the way back should replay it. */
export function markFeedReturn(): void {
  try {
    sessionStorage.setItem(markKey(window.location.pathname), '1');
  } catch {
    /* storage denied — the feed reshuffles, as it did before */
  }
}

export function rememberFeed<T>(feed: RememberedFeed<T>): void {
  const trimmed =
    feed.items.length > MAX_ITEMS ? { ...feed, items: feed.items.slice(0, MAX_ITEMS) } : feed;
  try {
    sessionStorage.setItem(feedKey(window.location.pathname), JSON.stringify(trimmed));
  } catch {
    /* over quota — same fallback */
  }
}

/** The feed to replay, if this page view is a return. Consumes the mark. */
export function recallFeed<T>(pathname: string): RememberedFeed<T> | null {
  if (!sessionStorage.getItem(markKey(pathname))) return null;
  sessionStorage.removeItem(markKey(pathname));

  const raw = sessionStorage.getItem(feedKey(pathname));
  if (!raw) return null;
  try {
    const feed = JSON.parse(raw) as RememberedFeed<T>;
    return feed.items?.length ? feed : null;
  } catch {
    return null;
  }
}
