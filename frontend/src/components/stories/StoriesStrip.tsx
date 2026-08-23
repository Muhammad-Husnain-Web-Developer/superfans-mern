import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchStoryStrip, type StripEntry } from '../../api/stories';
import { useAuth } from '../../context/AuthContext';
import { AddStoryModal } from './AddStoryModal';
import { StoryRing } from './StoryRing';
import { StoryViewer } from './StoryViewer';
import '../../styles/stories.css';

/**
 * The row of ringed avatars above the feed (mockup Pas 7), with the ◀ ▶ the mockup draws at
 * either end. Watching one creator to the end rolls on to the next in the row, so the strip
 * plays through rather than dumping the viewer back each time.
 *
 * Your own circle always leads the row, ringed only when you have something running, and
 * carrying the + that opens Add Storie — the arrangement the client asked for. The row is
 * therefore shown to a signed-in viewer even when nobody has posted yet.
 */
export function StoriesStrip() {
  const [items, setItems] = useState<StripEntry[] | null>(null);
  const [openAt, setOpenAt] = useState<number | null>(null);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [arrows, setArrows] = useState({ left: false, right: false, scrollable: false });
  const [addOpen, setAddOpen] = useState(false);
  const { user: authUser } = useAuth();
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

  function open(i: number, list: StripEntry[]) {
    /* an empty circle is an invitation to post, not something to watch */
    if (list[i]?.count === 0) {
      setAddOpen(true);
      return;
    }
    setOpenAt(i);
    const handle = list[i]?.user.usernameUrl;
    if (handle) setSeen((s) => new Set(s).add(handle));
  }

  if (!items) return null;

  /* Your own circle comes first whether or not you have a story running; the API already
     sorts a self entry to the front, so it is only synthesised when it is not there. */
  const mine = items.find((i) => i.isSelf);
  const rest = items.filter((i) => !i.isSelf);
  const selfEntry: StripEntry | null =
    mine ??
    (authUser
      ? {
          user: {
            id: authUser.id,
            usernameUrl: authUser.usernameUrl ?? null,
            name: authUser.name ?? null,
            profilePicture: authUser.profilePicture ?? null,
            verified: false,
          },
          count: 0,
          latestAt: '',
          isSelf: true,
          viewerFollowing: false,
        }
      : null);
  const row = selfEntry ? [selfEntry, ...rest] : rest;
  if (row.length === 0) return null;

  const active = openAt !== null ? row[openAt] : null;

  return (
    <>
      <div className="stories-strip-wrap">
        {/* both arrows are always on show; they dim rather than disappear when the row
            has nothing left to move in that direction */}
        <button
          type="button"
          className="stories-strip-arrow"
          onClick={() => scrollBy(-1)}
          disabled={!arrows.left}
          aria-label="Previous"
        >
          ◀
        </button>
        <div className="stories-strip" ref={railRef} onScroll={refreshArrows}>
          {row.map((entry, i) => (
            <div
              className={`stories-strip-item${entry.isSelf ? ' self' : ''}`}
              key={entry.user.id}
              title={entry.user.usernameUrl ?? ''}
            >
              {/* 68 inside the 3px ring makes the 74px circle the mockup draws; it carries
                  no caption there, so the handle lives in the title attribute instead */}
              <StoryRing
                picture={entry.user.profilePicture}
                size={68}
                ring={entry.count > 0}
                seen={entry.user.usernameUrl ? seen.has(entry.user.usernameUrl) : false}
                alt={entry.user.usernameUrl ?? ''}
                onClick={() => open(i, row)}
              />
              {entry.isSelf && (
                <button
                  type="button"
                  className="stories-strip-add"
                  title="Add Storie"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAddOpen(true);
                  }}
                >
                  +
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          className="stories-strip-arrow"
          onClick={() => scrollBy(1)}
          disabled={!arrows.right}
          aria-label="Next"
        >
          ▶
        </button>
      </div>

      {addOpen && (
        <AddStoryModal
          onClose={() => setAddOpen(false)}
          onPosted={() => {
            fetchStoryStrip()
              .then(setItems)
              .catch(() => undefined);
          }}
        />
      )}

      {active?.user.usernameUrl && (
        <StoryViewer
          key={active.user.usernameUrl}
          usernameUrl={active.user.usernameUrl}
          onClose={() => setOpenAt(null)}
          onFinished={() => {
            const next = (openAt ?? 0) + 1;
            if (next < row.length) open(next, row);
            else setOpenAt(null);
          }}
        />
      )}
    </>
  );
}
