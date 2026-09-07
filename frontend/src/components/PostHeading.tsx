import { useEffect, useRef, useState, type ReactNode } from 'react';
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
  const runRef = useRef<HTMLSpanElement | null>(null);
  const [overflows, setOverflows] = useState(false);
  const { t: tUi } = useTranslation('ui');

  const handles = [...(author ? [author] : []), ...tagged].filter((h) => h.usernameUrl);

  useEffect(() => {
    const run = runRef.current;
    const slot = run?.parentElement;
    if (!run || !slot) return;
    const measure = () => setOverflows(run.scrollWidth > slot.clientWidth + 1);
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

  if (handles.length === 0) return null;

  return (
    <p
      className="feed_posts_heading_p feed-heading-flex"
      style={{ position: 'relative', top: 25, fontSize: 14, marginBottom: 12 }}
    >
      <span className={`feed_posts_heading_left${overflows ? ' is-overflowing' : ''}`}>
        <span className="feed_posts_heading_marquee" ref={runRef}>
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
      {right && <span className="feed_posts_heading_right">{right}</span>}
    </p>
  );
}
