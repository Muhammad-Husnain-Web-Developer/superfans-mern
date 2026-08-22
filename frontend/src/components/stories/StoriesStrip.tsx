import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchStoryStrip, type StripEntry } from '../../api/stories';
import { StoryRing } from './StoryRing';
import { StoryViewer } from './StoryViewer';
import '../../styles/stories.css';

/**
 * The row of ringed avatars above the feed (mockup Pas 7), with the ◀ ▶ the mockup draws at
 * either end. Watching one creator to the end rolls on to the next in the row, so the strip
 * plays through rather than dumping the viewer back each time.
 *
 * Renders nothing at all when nobody has a live story — an empty grey bar would be worse
 * than no bar.
 */
export function StoriesStrip() {
  const [items, setItems] = useState<StripEntry[] | null>(null);
  const [openAt, setOpenAt] = useState<number | null>(null);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [arrows, setArrows] = useState({ left: false, right: false, scrollable: false });
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchStoryStrip()
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshArrows = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    setArrows({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
      /* nothing to scroll means no arrows at all, and the few circles there are sit in
         the middle of the bar rather than hugging its left edge */
      scrollable: el.scrollWidth > el.clientWidth + 4,
    });
  }, []);

  useEffect(() => {
    refreshArrows();
    window.addEventListener('resize', refreshArrows);
    return () => window.removeEventListener('resize', refreshArrows);
  }, [items, refreshArrows]);

  function scrollBy(direction: -1 | 1) {
    const el = railRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(160, el.clientWidth * 0.8), behavior: 'smooth' });
  }

  function open(i: number) {
    setOpenAt(i);
    const handle = items?.[i]?.user.usernameUrl;
    if (handle) setSeen((s) => new Set(s).add(handle));
  }

  if (!items || items.length === 0) return null;

  const active = openAt !== null ? items[openAt] : null;

  return (
    <>
      <div className="stories-strip-wrap">
        {arrows.scrollable && (
          <button
            type="button"
            className="stories-strip-arrow"
            onClick={() => scrollBy(-1)}
            disabled={!arrows.left}
            aria-label="Previous"
          >
            ◀
          </button>
        )}
        <div
          className={`stories-strip${arrows.scrollable ? '' : ' centred'}`}
          ref={railRef}
          onScroll={refreshArrows}
        >
          {items.map((entry, i) => (
            <button
              type="button"
              className="stories-strip-item"
              key={entry.user.id}
              onClick={() => open(i)}
              title={entry.user.usernameUrl ?? ''}
            >
              {/* 68 inside the 3px ring makes the 74px circle the mockup draws; it carries
                  no caption there, so the handle lives in the title attribute instead */}
              <StoryRing
                picture={entry.user.profilePicture}
                size={68}
                seen={entry.user.usernameUrl ? seen.has(entry.user.usernameUrl) : false}
                alt={entry.user.usernameUrl ?? ''}
              />
            </button>
          ))}
        </div>
        {arrows.scrollable && (
          <button
            type="button"
            className="stories-strip-arrow"
            onClick={() => scrollBy(1)}
            disabled={!arrows.right}
            aria-label="Next"
          >
            ▶
          </button>
        )}
      </div>

      {active?.user.usernameUrl && (
        <StoryViewer
          key={active.user.usernameUrl}
          usernameUrl={active.user.usernameUrl}
          onClose={() => setOpenAt(null)}
          onFinished={() => {
            const next = (openAt ?? 0) + 1;
            if (next < items.length) open(next);
            else setOpenAt(null);
          }}
        />
      )}
    </>
  );
}
