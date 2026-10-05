import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { markFeedReturn } from '../utils/feedMemory';
import { rememberScroll } from '../utils/useScrollMemory';
import { assetImage } from '../utils/format';
import '../styles/post-heading.css';

export interface HeadingHandle {
  usernameUrl: string;
  profilePicture?: string | null;
  verified?: boolean;
}

/**
 * The grey strip above a post: its author's handle, then anyone tagged in it.
 *
 * The world feed and the profile grids all render this, so it lives in one
 * place — a second copy is how the wall ended up scrolling every handle,
 * including the short ones that already fit.
 */
/** how fast the handle strip scrolls. The old fixed 10s covered 300px, which is this. */
const MARQUEE_PX_PER_SEC = 30;

/**
 * The scrolling run of handles itself, without the grey box around it.
 *
 * A post's heading is this box; an ad's tag is the same box, with "Super Ads" leading the
 * run — one label, then the advertiser's own handle when they have asked for it — rather
 * than a second box of its own beside it. Both carry the same run: measured travel, one
 * pace, one animation. Keeping it in one component is what stops the two drifting apart.
 */
export function HandleMarquee({
  handles,
  leading,
}: {
  handles: HeadingHandle[];
  /** content that leads the scrolling run, ahead of the handles — "Super Ads", on an ad's
      tag. Travels with the handles when the run is too long for the box; static text, not
      a link, so it carries none of a handle's own styling or click handling. */
  leading?: ReactNode;
}) {
  const runRef = useRef<HTMLSpanElement | null>(null);
  /* null while the handles fit the slot; otherwise the travel this particular run needs */
  const [marquee, setMarquee] = useState<{ from: number; to: number; seconds: number } | null>(null);
  const { t: tUi } = useTranslation('ui');

  useEffect(() => {
    const run = runRef.current;
    const slot = run?.parentElement;
    if (!run || !slot) return;
    /* The travel is measured, not written in the stylesheet. The keyframes used to run from
       translateX(100%) to -100%, and that percentage is of the run's own box — the slot's
       150px — so a strip of two handles, or one long one, turned back to the start while
       half of it was still unread. From the right edge of the slot to clear off the left is
       `slot + content`, whatever the handles happen to be, and holding the pace at a fixed
       px/s keeps a long strip from racing a short one. */
    const measure = () => {
      const content = run.scrollWidth;
      const visible = slot.clientWidth;
      if (content <= visible + 1) {
        setMarquee(null);
        return;
      }
      const next = { from: visible, to: -content, seconds: (visible + content) / MARQUEE_PX_PER_SEC };
      setMarquee((prev) =>
        prev && prev.from === next.from && prev.to === next.to ? prev : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(slot);
    /* avatars land after the first paint and lengthen the run */
    const avatars = Array.from(run.querySelectorAll('img'));
    avatars.forEach((img) => img.addEventListener('load', measure));
    return () => {
      observer.disconnect();
      avatars.forEach((img) => img.removeEventListener('load', measure));
    };
  }, [handles.map((h) => h.usernameUrl).join('|')]);

  return (
    <span className={`feed_posts_heading_left${marquee ? ' is-overflowing' : ''}`}>
      <span
        className="feed_posts_heading_marquee"
        ref={runRef}
        style={
          marquee
            ? ({
                '--marquee-from': `${marquee.from}px`,
                '--marquee-to': `${marquee.to}px`,
                '--marquee-duration': `${marquee.seconds}s`,
              } as CSSProperties)
            : undefined
        }
      >
        {leading}
        {handles.map((h) => (
          <Link
            key={h.usernameUrl}
            to={`/${h.usernameUrl}`}
            onClick={(e) => {
              e.stopPropagation();
              /* the client asks for the world feed to be waiting unchanged if
                 the reader opens a creator from it and comes back. Marks the
                 listing being left, whichever one it is; only that listing
                 ever reads its own mark. */
              rememberScroll();
              markFeedReturn();
            }}
            style={{ color: 'black', display: 'inline-flex', alignItems: 'center', marginRight: 10 }}
          >
            {h.profilePicture && (
              <img
                className="feed_posts_heading_img"
                src={assetImage(h.profilePicture)}
                alt=""
                style={{ marginRight: 10, marginBottom: 0 }}
              />
            )}
            <span>@{h.usernameUrl}</span>
            {h.verified && (
              <img
                src={assetImage('verified.png')}
                alt={tUi('alt_verified')}
                width={18}
                height={18}
                style={{ marginLeft: 5, verticalAlign: 'middle', display: 'inline-block' }}
              />
            )}
          </Link>
        ))}
      </span>
    </span>
  );
}

export function PostHeading({
  author,
  tagged = [],
  right,
}: {
  author?: HeadingHandle | null;
  tagged?: HeadingHandle[];
  /** the report control, on the grids that carry one */
  right?: ReactNode;
}) {
  /* One entry per account. A post may tag its own author — 12 of them in the migrated data
     do, @superzubair's among them — and that put the same handle in this strip twice, which
     React then reported as two children sharing a key. The author is listed first, so keeping
     the first of each also keeps them at the front where they belong. */
  const handles = [...(author ? [author] : []), ...tagged]
    .filter((h) => h.usernameUrl)
    .filter((h, i, all) => all.findIndex((other) => other.usernameUrl === h.usernameUrl) === i);

  if (handles.length === 0) return null;

  return (
    <p
      className="feed_posts_heading_p feed-heading-flex"
      style={{ position: 'relative', top: 20, fontSize: 14, marginBottom: 12 }}
    >
      <HandleMarquee handles={handles} />
      {right && <span className="feed_posts_heading_right">{right}</span>}
    </p>
  );
}
