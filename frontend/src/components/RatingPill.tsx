import { likeFill, likeLevel } from '../utils/format';
import '../styles/rating-pill.css';

/**
 * The wall's ❤️ · %Liked/Hated · 💩 group — the markup that sits commented out in
 * world.blade.php:1318 and user/world.blade.php:2412, brought back because the client asked
 * for it on the walls. Horizontal here; the full-screen viewer keeps its own vertical rail.
 *
 * Purely presentational: the card owns the like/hate state so the view counter beside it
 * stays in step with the same toggle.
 */
export function RatingPill({
  pct,
  liked,
  hated,
  beat = false,
  bounce = false,
  orientation = 'horizontal',
  onLike,
  onHate,
}: {
  pct: number | null;
  liked: boolean;
  hated: boolean;
  /** the 0.6s heart-beat / poop-bounce that rides with the sound */
  beat?: boolean;
  bounce?: boolean;
  /** the walls lay it along the card; the full-screen viewer stands it up the rail */
  orientation?: 'horizontal' | 'vertical';
  onLike: () => void;
  onHate: () => void;
}) {
  const stop = (e: React.MouseEvent, run: () => void) => {
    e.stopPropagation();
    e.preventDefault();
    run();
  };

  return (
    <div
      className={orientation === 'vertical' ? 'actions-group rating-vertical' : 'actions-group'}
      onClick={(e) => e.stopPropagation()}
    >
      <span
        className={beat ? 'heart heart-animate' : 'heart'}
        style={{ cursor: 'pointer' }}
        onClick={(e) => stop(e, onLike)}
      >
        <i className={liked ? 'icon-heart' : 'icon-heart-o'} />
      </span>

      {/* The pill only reports the split — the two icons beside it are the buttons. The blade
          wired the whole pill to hate (`class="rating-pill hate_post"`), so clicking the red
          "83% Liked" half hated the post; the client asked for that click to go away.

          The red is a fill on a black track, and it stands at one of four marks — 25, 50, 75
          or 100 — while the number beside it stays true. The labels keep their places so a
          low mark cannot squeeze them out; only the fill moves, and it slides. */}
      <div
        className="rating-pill"
        style={{ '--sf-fill': `${likeFill(likeLevel(pct))}%` } as React.CSSProperties}
      >
        <span className="rating-fill" aria-hidden="true" />
        <div className="liked-segment">
          <span className="thumb-up">👍🏻</span>
          {/* With a percentage the half speaks for everyone — "83% Liked" — and the viewer's
              own vote shows in the heart beside it. With nothing to report it speaks to the
              viewer instead: "Like" until they cast one, "Liked" after. ("83% Like" would be
              the two readings colliding, and the client's reference reads "83% Liked".) */}
          <span className="liked-text">{pct === null ? (liked ? 'Liked' : 'Like') : `${pct}% Liked`}</span>
        </div>
        <div className="hated-segment">
          <span className="thumb-down">👎🏻</span>
          <span className="hated-text">{hated ? 'Hated' : 'Hate'}</span>
        </div>
      </div>

      {/* The client's own artwork in place of the emoji, and at full strength whether or not
          the viewer has hated the post — the blade dimmed the idle state, which the client
          asked to drop. `enable` stays on the element for anything else hanging off it. */}
      <span
        className={`${hated ? 'poop enable' : 'poop'}${bounce ? ' poop-animate' : ''}`}
        style={{ cursor: 'pointer' }}
        onClick={(e) => stop(e, onHate)}
      >
        <img src="/brand/caca.webp" alt="Hate" className="poop-img" draggable={false} />
      </span>
    </div>
  );
}
