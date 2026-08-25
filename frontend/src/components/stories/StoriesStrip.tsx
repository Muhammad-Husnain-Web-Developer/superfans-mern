import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchStoryStrip, type StripEntry } from '../../api/stories';
import { useAuth } from '../../context/AuthContext';
import { AddStoryModal } from './AddStoryModal';
import { StoryRing } from './StoryRing';
import { StoryViewer } from './StoryViewer';
import '../../styles/stories.css';

/* The circle's diameter. It lives here rather than in the stylesheet because StoryRing sizes
   the picture through width/height attributes, which CSS custom properties cannot reach. */
const CIRCLE = 44;
/* the ring's own padding. An un-ringed circle is drawn this much larger so that ringed and
   un-ringed sit in the same 50px footprint and every caption lands on one line. */
const RING_PAD = 3;

/** ◀ ▶ as the client draws them: a black-edged triangle filled with the app's own blue. */
function Arrow({
  dir,
  disabled,
  onClick,
}: {
  dir: -1 | 1;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="stories-strip-arrow"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === -1 ? 'Previous' : 'Next'}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d={dir === -1 ? 'M17 2 L4 12 L17 22 Z' : 'M7 2 L20 12 L7 22 Z'} />
      </svg>
    </button>
  );
}

/**
 * The row of ringed avatars above the feed (mockup Pas 7), with the ◀ ▶ the mockup draws at
 * either end. Watching one creator to the end rolls on to the next in the row, so the strip
 * plays through rather than dumping the viewer back each time.
 *
 * Your own circle is pinned outside the scrolling rail, so it stays in reach however far the
 * row is dragged — the client's own instruction. It is ringed only when you have something
 * running, and carries the + that opens Add Storie, so the row is shown to a signed-in viewer
 * even when nobody has posted yet. Every circle is captioned with its owner's name.
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
  /* the viewer walks this order — your own first, then the rail left to right — even though
     the first of them is drawn outside the rail */
  const row = selfEntry ? [selfEntry, ...rest] : rest;
  if (row.length === 0) return null;

  const active = openAt !== null ? row[openAt] : null;

  const circle = (entry: StripEntry, index: number) => (
    <div
      className={`stories-strip-item${entry.isSelf ? ' self' : ''}`}
      key={entry.user.id}
      title={entry.user.name ?? entry.user.usernameUrl ?? ''}
    >
      {/* the + rides on the picture, so it keeps its corner now that a caption sits below */}
      <span className="stories-strip-photo">
        <StoryRing
          picture={entry.user.profilePicture}
          size={entry.count > 0 ? CIRCLE : CIRCLE + RING_PAD * 2}
          ring={entry.count > 0}
          seen={entry.user.usernameUrl ? seen.has(entry.user.usernameUrl) : false}
          alt={entry.user.usernameUrl ?? ''}
          onClick={() => open(index, row)}
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
      </span>
      <span className="stories-strip-name">
        {entry.user.name ?? entry.user.usernameUrl ?? ''}
      </span>
    </div>
  );

  return (
    <>
      <div className="stories-strip-wrap">
        {/* both arrows are always on show; they dim rather than disappear when the row
            has nothing left to move in that direction */}
        <Arrow dir={-1} disabled={!arrows.left} onClick={() => scrollBy(-1)} />

        {/* pinned: the rail scrolls past it, it never leaves */}
        {selfEntry && circle(selfEntry, 0)}
        {/* the rule that sets your own circle apart from the row — drawn only when there is
            a row to be set apart from */}
        {selfEntry && rest.length > 0 && <span className="stories-strip-sep" />}

        <div className="stories-strip" ref={railRef} onScroll={refreshArrows}>
          {rest.map((entry, k) => circle(entry, k + 1))}
        </div>

        <Arrow dir={1} disabled={!arrows.right} onClick={() => scrollBy(1)} />
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
