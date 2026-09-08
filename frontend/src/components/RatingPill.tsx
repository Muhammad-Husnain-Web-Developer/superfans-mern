import { likeFill, likeLevel } from '../utils/format';
import { useTranslation } from 'react-i18next';
import '../styles/rating-pill.css';

/**
 * The wall's ❤️ · %Liked/Hated · 💩 group — the markup that sits commented out in
 * world.blade.php:1318 and user/world.blade.php:2412, brought back because the client asked
 * for it on the walls. Horizontal here; the full-screen viewer keeps its own vertical rail.
 *
 * Purely presentational: the card owns the like/hate state so the view counter beside it
 * stays in step with the same toggle.
 */
/**
 * The least of the pill the grey may take once the viewer has hated.
 *
 * The client asked for a quarter, then for a third. Measured against the longest the half
 * ever reads — "100% Hated" — neither was enough on its own: at 25% the word hangs 16px past
 * the pill, at 30% 9px, at 35% still 2px, and the pill clips whatever passes it.
 * What closes it is 35 together with the air the client spotted to the left of the word
 * inside the grey (rating-pill.css takes that from 14px to 8px); the two give it room to
 * spare on the desktop wall and on a phone alike.
 */
const HATE_BAR_FLOOR = 35;

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
  const { t: tUi } = useTranslation('ui');
  const stop = (e: React.MouseEvent, run: () => void) => {
    e.stopPropagation();
    e.preventDefault();
    run();
  };

  /**
   * One number at a time, and it belongs to the half the viewer pressed: "If we click LIKE ->
   * we show the Liked %. If we click HATE -> we show the Hated %" — and only that half changes
   * its word: "if we click Like -> Liked (Hate stills Hate, not Hated)".
   *
   * So a viewer who has not voted reads a plain Like / Hate with no figure, and the hated
   * share is simply the rest of the liked one.
   *
   * A deliberate deviation from the blade, which writes `like_percent + '% Liked'` on both
   * paths (user/world.blade.php:3578 and :3600) and never prints the hate_percent its own
   * controller works out — the client asked for this after seeing that.
   */
  const likedLabel = liked ? (pct === null ? 'Liked' : `${pct}% Liked`) : 'Like';
  const hatedLabel = hated ? (pct === null ? 'Hated' : `${100 - pct}% Hated`) : 'Hate';

  /**
   * How far the red is drawn — and, once the viewer has hated, it is the grey that is being
   * drawn instead.
   *
   * The bar belongs to the half that has something to report. On a like that is the red, at
   * one of the client's four marks. On a hate the grey takes the hate's own share of the pill
   * and the red is left with the rest — "if the hate percentage is under 25%, still take 25%
   * width; otherwise as before". The floor is what keeps a one-in-ten hate from drawing a
   * sliver too thin to read a figure on.
   *
   * Either way the width lands on `min-width`, which carries a 0.3s transition, so the change
   * is a growth rather than a jump — the client's "Growth Animation Bar".
   */
  const hatePct = pct === null ? null : 100 - pct;
  const fill =
    hated && hatePct !== null
      ? 100 - Math.max(hatePct, HATE_BAR_FLOOR)
      : likeFill(likeLevel(pct));

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
        /* `is-liked` stands the quiet 👎 half back up on two lines, which is the client's own
           rule: "When you click LIKE, the HATE becomes vertical." It is also what makes room —
           the half carrying the percentage needs the width, and stacked the other one gives up
           22px of it. */
        className={`rating-pill${liked ? ' is-liked' : ''}${hated ? ' is-hated' : ''}`}
        style={{ '--sf-fill': `${fill}%` } as React.CSSProperties}
      >
        <span className="rating-fill" aria-hidden="true" />
        <div className="liked-segment">
          <span className="thumb-up">👍🏻</span>
          <span className="liked-text">{likedLabel}</span>
        </div>
        <div className="hated-segment">
          <span className="thumb-down">👎🏻</span>
          <span className="hated-text">{hatedLabel}</span>
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
        <img src="/brand/caca.webp" alt={tUi('alt_hate')} className="poop-img" draggable={false} />
      </span>
    </div>
  );
}
