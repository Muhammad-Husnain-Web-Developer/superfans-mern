import { useSyncExternalStore } from 'react';

/**
 * The unread notification count, in one place.
 *
 * It used to live inside NotificationsBell, which was fine while the bell was the only
 * thing drawing it. David, 30 Sep 2026, moved the bell into the sidebar's dropdown and
 * asked for the count to sit on the profile mark beside the @nickname instead — so two
 * unrelated components now need the same number, and it has to fall to zero in both the
 * moment the panel is opened.
 *
 * A module-level store rather than a context: the bar's bell and the sidebar's are
 * separate mounts under different parents, and this keeps them showing the same figure
 * without a provider having to wrap the pair.
 */
let count = 0;
const listeners = new Set<() => void>();

export function setUnreadCount(next: number): void {
  if (next === count) return;
  count = next;
  /* a copy: a listener may unsubscribe from inside its own callback */
  for (const fn of [...listeners]) fn();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/**
 * The live count, re-rendering the caller whenever it changes.
 *
 * useSyncExternalStore rather than a useState kept in step by an effect: this is exactly
 * the store-outside-React case it exists for, and it reads the current value during
 * render, so a component that mounts after the count has already been fetched shows the
 * right number on its first paint instead of a zero it corrects a frame later.
 */
export function useUnreadCount(): number {
  return useSyncExternalStore(subscribe, () => count);
}
