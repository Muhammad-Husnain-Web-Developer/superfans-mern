import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  deleteStory,
  fetchUserStories,
  markStorySeen,
  STORY_IMAGE_SECONDS,
  type Story,
  type StoryOwner,
} from '../../api/stories';
import { api } from '../../api/client';
import { assetImage, videoMime } from '../../utils/format';
import { useAuth } from '../../context/AuthContext';
import { SwalResult } from '../../pages/profile/Profile';
import { StoryRing } from './StoryRing';
import '../../styles/stories.css';
import '../../styles/story-editor.css';

/* The progress bars are coloured, not white: mockup Pas 6 (Storie 2.png) draws five
   segments in this order, and the palette is the editor's own — the yellow of the text
   colours, the green and blue of the link chips. More stories than colours simply start
   the sequence again. */
const BAR_COLOURS = ['#fff200', '#0ed145', '#8cfffb', '#00a8f3', '#0014f3'];

/** the same colour at reduced strength, for the part of a bar still to come */
function faded(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/* the same five reasons the post viewer offers, which is what the client asked for here */
const REPORT_REASONS = ['Excessive sensuality', 'Impersonation', 'Violence', 'Racism', 'Other'];
const REASON_KEY: Record<string, string> = {
  'Excessive sensuality': 'sensuality',
  Impersonation: 'impersonation',
  Violence: 'violence',
  Racism: 'racism',
  Other: 'other',
};

/**
 * The full-screen player (mockup Pas 6): one segmented progress bar per story, the owner's
 * ringed avatar and handle, and the square caret. A still is held for five seconds; a clip
 * runs for its own length, so the bar and the picture always finish together.
 */
export function StoryViewer({
  usernameUrl,
  onClose,
  onFinished,
}: {
  usernameUrl: string;
  onClose: () => void;
  /** ran past the last story — the strip uses this to open the next creator */
  onFinished?: () => void;
}) {
  const { t: tReport } = useTranslation('report');
  const { t } = useTranslation('stories');
  const { user: authUser } = useAuth();
  const [owner, setOwner] = useState<StoryOwner | null>(null);
  const [stories, setStories] = useState<Story[] | null>(null);
  const [index, setIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  /* Reporting and sharing answer with the same dialog a post does, rather than a toast
     of their own — SwalResult is the app's confirmation everywhere else. */
  const [swal, setSwal] = useState<{ icon?: 'success' | 'error'; title: string; text?: string } | null>(null);
  /* the second tap of the two-step delete */
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fillRef = useRef<HTMLSpanElement>(null);
  const barsRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pausedRef = useRef(false);

  /* opening the menu holds the story where it is — a menu that closes itself a moment
     later because the clock ran on is not usable */
  pausedRef.current = menuOpen || swal !== null;
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (menuOpen || swal) v.pause();
    else void v.play().catch(() => undefined);
  }, [menuOpen, swal]);

  useEffect(() => {
    let cancelled = false;
    setStories(null);
    setIndex(0);
    fetchUserStories(usernameUrl)
      .then((d) => {
        if (cancelled) return;
        setOwner(d.user);
        setStories(d.stories);
      })
      .catch(() => {
        if (!cancelled) setStories([]);
      });
    return () => {
      cancelled = true;
    };
  }, [usernameUrl]);

  const current = stories && stories.length > index ? stories[index] : null;

  const advance = useCallback(() => {
    setMenuOpen(false);
    setIndex((i) => {
      if (!stories) return i;
      if (i + 1 < stories.length) return i + 1;
      /* past the end: hand back to whoever opened this */
      if (onFinished) onFinished();
      else onClose();
      return i;
    });
  }, [stories, onFinished, onClose]);

  const back = useCallback(() => {
    setMenuOpen(false);
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  /* the bar fills over the story's own length, then hands over to the next one */
  useEffect(() => {
    if (!current) return;
    void markStorySeen(current.id);

    const seconds =
      current.mediaType === 'video'
        ? (current.durationSeconds && current.durationSeconds > 0 ? current.durationSeconds : STORY_IMAGE_SECONDS)
        : STORY_IMAGE_SECONDS;

    /* Every bar but the current one is redrawn from the index. React would not do it on
       its own: the width it hands a bar that was current is 0 both before and after, so it
       sees no change while the animation has left a half-filled bar behind — which is what
       jumping backwards used to show. */
    barsRef.current?.querySelectorAll<HTMLSpanElement>('.story-viewer-bar > span').forEach((span, i) => {
      if (i !== index) span.style.width = i < index ? '100%' : '0';
    });

    /* elapsed is accumulated rather than read off a start stamp, so the clock can be held
       still while the caret menu is open instead of running out under it */
    let elapsed = 0;
    let last = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const dt = now - last;
      last = now;
      if (!pausedRef.current) elapsed += dt;
      const done = Math.min(1, elapsed / (seconds * 1000));
      if (fillRef.current) fillRef.current.style.width = `${done * 100}%`;
      if (done >= 1) {
        advance();
        return;
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [current, index, advance]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') advance();
      else if (e.key === 'ArrowLeft') back();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [advance, back, onClose]);

  /* Delete belongs to the author alone. The check is on the story's own owner rather than
     on whose page this was opened from, and the server refuses anyone else regardless. */
  const isMine = Boolean(authUser && owner && authUser.id === owner.id);

  function removeCurrent() {
    if (!current || !isMine) return;
    const id = current.id;
    setConfirmDelete(false);
    setMenuOpen(false);
    void deleteStory(id)
      .then(() => {
        setStories((list) => {
          const next = (list ?? []).filter((st) => st.id !== id);
          if (next.length === 0) onClose();
          else setIndex((i) => Math.min(i, next.length - 1));
          return next;
        });
      })
      .catch(() => setSwal({ icon: 'error', title: tReport('failed_title'), text: tReport('failed_message') }));
  }

  function submitReport(reason: string) {
    if (!current) return;
    setMenuOpen(false);
    api
      .post('/users/reports/story', { storyId: current.id, username: usernameUrl, reason })
      .then(() => setSwal({ icon: 'success', title: tReport('sent_title'), text: tReport('thank_you') }))
      .catch(() => setSwal({ icon: 'error', title: tReport('failed_title'), text: tReport('failed_message') }));
  }

  function copyStoryLink() {
    setMenuOpen(false);
    const write = navigator.clipboard?.writeText(`${window.location.origin}/stories/${usernameUrl}`);
    if (!write) {
      setSwal({ icon: 'error', title: tReport('share.failed') });
      return;
    }
    void write
      .then(() => setSwal({ icon: 'success', title: tReport('share.copied') }))
      .catch(() => setSwal({ icon: 'error', title: tReport('share.failed') }));
  }

  return (
    <div className="story-viewer" onClick={() => setMenuOpen(false)}>
      <div className="story-viewer-bars" ref={barsRef}>
        {(stories ?? [null]).map((s, i) => {
          const colour = BAR_COLOURS[i % BAR_COLOURS.length];
          return (
            <button
              type="button"
              className="story-viewer-bar"
              key={s ? s.id : i}
              /* a bar is also the way to reach its story directly, forwards or back */
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                if (stories && i < stories.length) setIndex(i);
              }}
              title={`${i + 1}/${stories?.length ?? 1}`}
              style={{ background: faded(colour, 0.3) }}
            >
              <span
                ref={i === index ? fillRef : undefined}
                style={{ width: i < index ? '100%' : 0, background: colour }}
              />
            </button>
          );
        })}
      </div>

      <div className="story-viewer-head">
        <StoryRing picture={owner?.profilePicture ?? null} size={32} alt={owner?.usernameUrl ?? ''} />
        <Link to={`/${usernameUrl}`} className="story-viewer-handle">
          @ {usernameUrl}
        </Link>
        <span className="story-viewer-spacer" />
        <div className="story-viewer-menu-wrap" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="story-viewer-caret"
            title="Options"
            onClick={() => {
              setConfirmDelete(false);
              setMenuOpen((v) => !v);
            }}
          >
            <i className="fas fa-caret-down" aria-hidden="true"></i>
          </button>
          {menuOpen && (
            <ul className="story-viewer-menu">
              <li>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    copyStoryLink();
                  }}
                >
                  📤 {t('share')}
                </a>
              </li>
              {isMine &&
                (confirmDelete ? (
                  <li className="story-viewer-confirm">
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        removeCurrent();
                      }}
                    >
                      {t('delete_confirm')}
                    </a>
                    <a
                      href="#"
                      className="cancel"
                      onClick={(e) => {
                        e.preventDefault();
                        setConfirmDelete(false);
                      }}
                    >
                      {t('cancel')}
                    </a>
                  </li>
                ) : (
                  <li>
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setConfirmDelete(true);
                      }}
                    >
                      🗑 {t('delete')}
                    </a>
                  </li>
                ))}
              {REPORT_REASONS.map((reason) => (
                <li key={reason}>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      submitReport(reason);
                    }}
                  >
                    {tReport(`reasons.${REASON_KEY[reason]}`, { defaultValue: reason })}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          className="story-viewer-close"
          onClick={onClose}
          title="Close"
          style={{ marginLeft: 10 }}
        >
          ✕
        </button>
      </div>

      <div className="story-viewer-stage">
        {stories === null && <div className="story-viewer-empty">…</div>}
        {stories !== null && stories.length === 0 && (
          <div className="story-viewer-empty">{t('empty')}</div>
        )}
        {current && current.mediaType === 'video' ? (
          <video
            key={current.id}
            ref={videoRef}
            autoPlay
            playsInline
            controls={false}
            onEnded={advance}
          >
            <source src={assetImage(current.imageVideo)} type={videoMime(current.imageVideo)} />
          </video>
        ) : current ? (
          <img key={current.id} src={assetImage(current.imageVideo)} alt="" />
        ) : null}

        {/* whatever was placed in the editor, drawn back at the same fraction of the frame */}
        {current?.elements.map((el, i) => (
          <div
            key={i}
            className="story-item"
            style={{
              left: `${el.x * 100}%`,
              top: `${el.y * 100}%`,
              transform: `translate(-50%, -50%) rotate(${el.rotation}deg)`,
              cursor: el.kind === 'link' ? 'pointer' : 'default',
              zIndex: 2,
            }}
            onClick={(e) => {
              if (el.kind !== 'link' || !el.url) return;
              e.stopPropagation();
              window.open(el.url, '_blank', 'noopener');
            }}
          >
            {el.kind === 'tag' && (
              <Link
                to={`/${el.username}`}
                className="story-chip"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="dot" />@{el.username}
              </Link>
            )}
            {el.kind === 'link' && (
              <span className="story-chip" style={{ background: el.color }}>
                🔗 {el.title || el.url}
              </span>
            )}
            {el.kind === 'text' && (
              <div className={`story-text-box font-${el.font ?? 'gamer'}`} style={{ color: el.color }}>
                {el.text}
              </div>
            )}
          </div>
        ))}

        {current && (
          <>
            <div className="story-viewer-prev" onClick={back} />
            <div className="story-viewer-next" onClick={advance} />
          </>
        )}
      </div>

      {swal && (
        <div onClick={(e) => e.stopPropagation()}>
          <SwalResult {...swal} onClose={() => setSwal(null)} />
        </div>
      )}
    </div>
  );
}
