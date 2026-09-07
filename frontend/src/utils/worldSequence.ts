import type { AdCardItem } from '../components/AdCard';

/**
 * The run of the World feed the full-screen viewer walks when it is opened from the wall.
 *
 * It carries the ads as well as the posts, and in the feed's own order — the client asked for
 * the ads to appear in the full-screen scroll exactly as they do on the wall, which the server
 * already arranges by dropping one in after every sixth post (world.routes.ts). The wall used
 * to strip them out before handing the run over, so the viewer never saw one.
 *
 * A post is only its id: the viewer fetches the post itself anyway. An ad is carried whole,
 * because nothing else will fetch it.
 */
export type WorldStep = { type: 'post'; id: string } | ({ type: 'ad' } & AdCardItem);

/** the feed's own id for an ad — `ad_<adId>`, which is what the route then carries */
export function isAdStep(step: WorldStep): step is { type: 'ad' } & AdCardItem {
  return step.type === 'ad';
}

/** an id that names an ad rather than a post, so nothing tries to fetch a post for it */
export function isAdId(id: string): boolean {
  return id.startsWith('ad_');
}

/**
 * What came back from `/world` turned into steps.
 *
 * The shape is the feed's own item: `type` says which it is, and an ad already holds
 * everything its tile needs.
 */
export function toSteps(items: ({ type?: string; id: string } & AdCardItem)[]): WorldStep[] {
  return items.map((i) =>
    i.type === 'ad' ? ({ ...i, type: 'ad' } as WorldStep) : { type: 'post', id: i.id },
  );
}

/**
 * Read a run back out of the router state.
 *
 * A tab left open across a deploy can still hold the old shape — a plain array of post ids —
 * so that is understood too rather than throwing the viewer back to a dead end.
 */
export function readSteps(value: unknown): WorldStep[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (typeof value[0] === 'string') {
    return (value as string[]).map((id) => ({ type: 'post', id }));
  }
  return value as WorldStep[];
}

/**
 * The next page's steps added to the run, minus anything already in it.
 *
 * The feed reshuffles its pool on every request — Laravel does the same — so a later page can
 * hand back a post the viewer has already scrolled past. Without this the reel would double
 * back on itself.
 */
export function appendSteps(run: WorldStep[], incoming: WorldStep[]): WorldStep[] {
  const seen = new Set(run.map((s) => s.id));
  const fresh = incoming.filter((s) => !seen.has(s.id));
  return fresh.length ? [...run, ...fresh] : run;
}
