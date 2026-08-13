import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { assetImage, isVideoFile, videoMime } from '../../utils/format';
import { LOCKED_POST_IMAGE } from '../../utils/networkLogo';
import { useAuth } from '../../context/AuthContext';
import { SwalResult } from './Profile';
import '../../styles/report-menu.css';

interface FsPost {
  id: string;
  imageVideo: string | null;
  thumbnail: string | null;
  likesTotal: number;
  likesCount: number;
  hatesCount: number;
  viewerLiked: boolean;
  viewerHated: boolean;
  canView: boolean;
  viewerFollowing: boolean;
  createdAt: string;
  prevId: string | null;
  nextId: string | null;
  influencer: {
    id: string;
    name: string;
    usernameUrl: string | null;
    profilePicture: string | null;
    role: string;
    priceOfSubscription: number | null;
  } | null;
}

const REPORT_REASONS = ['Excessive sensuality', 'Impersonation', 'Violence', 'Racism', 'Other'];

/** Report-reasons key lookup so the dropdown shows the localized label (report.json). */
const REASON_KEY: Record<string, string> = {
  'Excessive sensuality': 'sensuality',
  Impersonation: 'impersonation',
  Violence: 'violence',
  Racism: 'racism',
  Other: 'other',
};

/** FontAwesome 5 solid heart (fa-heart) — matches the Laravel icon exactly. */
const HeartIcon = ({ size = 32 }: { size?: number }) => (
  <svg viewBox="0 0 512 512" width={size} height={size} fill="currentColor" aria-hidden="true">
    <path d="M462.3 62.6C407.5 15.9 326 24.3 275.7 76.2L256 96.5l-19.7-20.3C186.1 24.3 104.5 15.9 49.7 62.6c-62.8 53.6-66.1 149.8-9.9 207.9l193.5 199.8c12.5 12.9 32.8 12.9 45.3 0l193.5-199.8c56.3-58.1 53-154.3-9.8-207.9z" />
  </svg>
);

/** Back chevron (arrow-left-back.png is missing from the asset set). */
const BackIcon = () => (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

function likePct(likes: number, hates: number): number {
  const total = likes + hates;
  return total > 0 ? Math.round((likes / total) * 100) : 0;
}

/**
 * Full-screen "reels" post viewer — port of user/post_detail.blade.php
 * (/user/post_detail/:id, /influencer/post_detail/:id). Black full-bleed media with a
 * grey top bar (back + report), a bottom bar (avatar · @nick · +Follow) and a right rail
 * (heart · %Liked/Hate pill · 💩). Double-click likes with a heart pop; single click mutes
 * the video; vertical swipe moves prev/next.
 */
export function PostFullscreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  // World context: full-screen scroll follows the WORLD feed order (passed via router state),
  // not the influencer's own posts. Absent → fall back to the backend's sibling prev/next.
  const worldSeq = (location.state as { world?: string[] } | null)?.world ?? null;
  const { t: tReport } = useTranslation('report');
  const { t: tContent, i18n } = useTranslation('content');
  const { user: authUser } = useAuth();

  const [post, setPost] = useState<FsPost | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'notfound'>('loading');
  const [liked, setLiked] = useState(false);
  const [hated, setHated] = useState(false);
  const [likes, setLikes] = useState(0);
  const [hates, setHates] = useState(0);
  const [following, setFollowing] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [swal, setSwal] = useState<{ icon?: 'success' | 'error'; title: string; text?: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const likeSound = useRef<HTMLAudioElement>(null);
  const hateSound = useRef<HTMLAudioElement>(null);
  const lastTap = useRef(0);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStart = useRef({ x: 0, y: 0 });
  const wheelLock = useRef(false);
  const [pops, setPops] = useState<{ id: number; x: number; y: number }[]>([]);
  const mediaWrapRef = useRef<HTMLDivElement>(null);
  /* Reels behaviour: neighbours are fetched and their media warmed while the
     current post is on screen, so moving to one swaps instantly instead of
     blanking to the loading state. slideDir drives the entry animation. */
  const cache = useRef(new Map<string, FsPost>());
  const slideDir = useRef<'next' | 'prev' | null>(null);

  function applyPost(d: FsPost) {
    setPost(d);
    setLiked(d.viewerLiked);
    setHated(d.viewerHated);
    setFollowing(d.viewerFollowing);
    setLikes(d.likesCount);
    setHates(d.hatesCount);
    setState('ok');
  }

  useEffect(() => {
    let cancelled = false;
    const cached = cache.current.get(id);
    if (cached) {
      applyPost(cached);
      void api.post(`/posts/${id}/visit`).catch(() => undefined);
      return;
    }
    setState('loading');
    api
      .get<{ success: boolean; data: FsPost }>(`/posts/${id}`)
      .then((r) => {
        if (cancelled) return;
        const d = r.data.data;
        cache.current.set(d.id, d);
        applyPost(d);
        void api.post(`/posts/${id}/visit`).catch(() => undefined);
      })
      .catch(() => {
        if (!cancelled) setState('notfound');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  /* Warm both neighbours: their JSON, and the first frame / image itself. */
  useEffect(() => {
    if (!post) return;
    const ids = [post.prevId, post.nextId];
    if (worldSeq) {
      const i = worldSeq.indexOf(id);
      if (i >= 0) ids.push(worldSeq[i - 1] ?? null, worldSeq[i + 1] ?? null);
    }
    for (const nid of ids) {
      if (!nid || cache.current.has(nid)) continue;
      api
        .get<{ success: boolean; data: FsPost }>(`/posts/${nid}`)
        .then((r) => {
          const d = r.data.data;
          cache.current.set(d.id, d);
          if (!d.imageVideo || !d.canView) return;
          if (isVideoFile(d.imageVideo)) {
            const v = document.createElement('video');
            v.preload = 'auto';
            v.muted = true;
            v.src = assetImage(d.imageVideo);
          } else {
            new Image().src = assetImage(d.imageVideo);
          }
        })
        .catch(() => undefined);
    }
  }, [post, id, worldSeq]);

  function playLike() {
    const el = likeSound.current;
    if (el) { el.currentTime = 0; void el.play().catch(() => {}); }
  }
  function playHate() {
    const el = hateSound.current;
    if (el) { el.currentTime = 0; void el.play().catch(() => {}); }
  }

  function doLike(skipSound?: boolean) {
    if (!post) return;
    api
      .post<{ success: boolean; data: { status: string; likesCount: number; hatesCount: number } }>(
        `/posts/${post.id}/like-toggle`,
      )
      .then((r) => {
        const nowLiked = r.data.data.status === 'post liked';
        setLiked(nowLiked);
        if (nowLiked) setHated(false);
        setLikes(r.data.data.likesCount);
        setHates(r.data.data.hatesCount);
        if (!skipSound) playLike();
      })
      .catch(() => undefined);
  }

  function doHate() {
    if (!post) return;
    api
      .post<{ success: boolean; data: { status: string; likesCount: number; hatesCount: number } }>(
        `/me/hate/${post.id}`,
      )
      .then((r) => {
        const nowHated = r.data.data.status === 'post hated';
        setHated(nowHated);
        if (nowHated) setLiked(false);
        setLikes(r.data.data.likesCount);
        setHates(r.data.data.hatesCount);
        playHate();
      })
      .catch(() => undefined);
  }

  function follow() {
    if (!post?.influencer) return;
    api
      .post(`/me/follow/${post.influencer.id}`)
      .then(() => {
        setFollowing(true);
        setSwal({ title: 'Followed Successfully' });
      })
      .catch(() => setSwal({ icon: 'error', title: 'Something went wrong' }));
  }

  function submitReport(reason: string) {
    if (!post) return;
    setReportOpen(false);
    api
      .post('/users/reports/post', { postId: post.id, reason })
      .then(() => setSwal({ icon: 'success', title: tReport('sent_title'), text: tReport('thank_you') }))
      .catch(() => setSwal({ icon: 'error', title: tReport('failed_title'), text: tReport('failed_message') }));
  }

  function showHeartPop(clientX: number, clientY: number) {
    const rect = mediaWrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pid = Date.now();
    setPops((p) => [...p, { id: pid, x: clientX - rect.left, y: clientY - rect.top }]);
    setTimeout(() => setPops((p) => p.filter((x) => x.id !== pid)), 850);
  }

  function onMediaTap(e: React.MouseEvent) {
    if ((e.target as HTMLElement).tagName === 'A') return;
    const now = Date.now();
    if (now - lastTap.current < 350) {
      // double tap → like
      if (singleTapTimer.current) { clearTimeout(singleTapTimer.current); singleTapTimer.current = null; }
      lastTap.current = 0;
      playLike();
      showHeartPop(e.clientX, e.clientY);
      if (!liked) doLike(true);
      return;
    }
    // single tap → mute/unmute video (deferred so a double-tap can cancel it)
    const v = videoRef.current;
    if (v) {
      if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
      singleTapTimer.current = setTimeout(() => {
        singleTapTimer.current = null;
        v.muted = !v.muted;
      }, 400);
    }
    lastTap.current = now;
  }

  // Effective prev/next id — world sequence when in world context, else backend siblings.
  const targetId = (dir: 'next' | 'prev'): string | null => {
    if (worldSeq) {
      const i = worldSeq.indexOf(id);
      if (i >= 0) return dir === 'next' ? worldSeq[i + 1] ?? null : worldSeq[i - 1] ?? null;
    }
    return dir === 'next' ? post?.nextId ?? null : post?.prevId ?? null;
  };
  const go = (dir: 'next' | 'prev') => {
    const t = targetId(dir);
    if (!t) return;
    slideDir.current = dir;
    navigate(`/user/post_detail/${t}`, {
      replace: true, // a reel is one screen, not a history trail
      ...(worldSeq ? { state: { world: worldSeq } } : {}),
    });
  };
  const goNext = () => go('next');
  const goPrev = () => go('prev');

  function onTouchStart(e: React.TouchEvent) {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  function onTouchEnd(e: React.TouchEvent) {
    const dx = touchStart.current.x - e.changedTouches[0].clientX;
    const dy = touchStart.current.y - e.changedTouches[0].clientY;
    /* 50px, not 80 — a reel should answer a flick, not demand a full drag */
    if (Math.abs(dy) > 50 && Math.abs(dy) >= Math.abs(dx)) {
      if (dy > 0) goNext();
      else goPrev();
    }
  }

  // Desktop: mouse-wheel navigates prev/next (throttled so one notch = one post).
  function onWheel(e: React.WheelEvent) {
    if (Math.abs(e.deltaY) < 20 || wheelLock.current) return;
    wheelLock.current = true;
    setTimeout(() => { wheelLock.current = false; }, 320);
    if (e.deltaY > 0) goNext();
    else goPrev();
  }

  // Keyboard: ArrowUp/ArrowDown navigate prev/next.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') goNext();
      else if (e.key === 'ArrowUp') goPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post?.nextId, post?.prevId]);

  if (state === 'loading') return null;
  if (state === 'notfound' || !post) {
    return (
      <div style={{ textAlign: 'center', padding: '20vh 20px', fontFamily: 'Roboto, sans-serif' }}>
        <h1 style={{ fontSize: '4em', color: '#da1212' }}>404</h1>
        <p>Not Found</p>
      </div>
    );
  }

  const media = post.imageVideo;
  const author = post.influencer;
  const isOwner = !!authUser && author?.id === authUser.id;
  const worldBack = authUser?.role === 'influencer' ? '/influencer/world' : '/user/world';
  const pct = likePct(likes, hates);
  // Locked: reached (via swipe) a post the viewer can't see — show the subscribe/follow tile
  // instead of the media (David's "blocked post" full-screen state).
  const locked = !post.canView;
  /* day first, as the client's design shows it — plain "en" would render the
     American "November 26, 2022" */
  const dateLocale = (i18n.resolvedLanguage ?? 'en') === 'en' ? 'en-GB' : (i18n.resolvedLanguage ?? 'en');
  const postedOn = new Date(post.createdAt).toLocaleDateString(dateLocale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="post-fullscreen-wrap">
      <style>{`
        .post-fullscreen-wrap{position:fixed;inset:0;z-index:9999;background:#000;display:flex;align-items:center;justify-content:center;box-sizing:border-box}
        .post-fs-topbar{position:absolute;top:0;left:0;right:0;height:52px;background:#888;display:flex;align-items:center;justify-content:space-between;padding:0 16px;z-index:10}
        .post-fs-back{color:#fff;display:flex;align-items:center;justify-content:center;text-decoration:none;padding:8px}
        .post-fs-bottombar{position:absolute;bottom:0;left:0;right:0;min-height:72px;display:flex;align-items:center;padding:12px 16px;gap:12px;z-index:10}
        .post-fs-avatar{width:48px;height:48px;border-radius:50%;object-fit:cover;background:#555;flex-shrink:0}
        .post-fs-author{display:flex;flex-direction:column;justify-content:center;min-width:0;flex:1;gap:2px}
        .post-fs-nickname{color:#fff;font-weight:700;font-size:17px;line-height:1.1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .post-fs-date{color:#fff;font-size:12px;line-height:1.1;opacity:.85}
        .post-fs-follow-btn{background:#c9c9c9;color:#1a1a1a;border:none;padding:11px 18px;border-radius:4px;font-size:15px;font-weight:700;letter-spacing:.5px;cursor:pointer;white-space:nowrap}
        .post-fs-follow-btn:hover{background:#dcdcdc;color:#1a1a1a}
        .post-fs-rightbar{position:absolute;right:0;bottom:96px;display:flex;flex-direction:column;align-items:center;gap:16px;padding:16px 12px;z-index:10}
        .post-fs-heart{cursor:pointer;display:inline-flex;align-items:center;justify-content:center;min-width:36px;min-height:36px}
        .post-fs-heart svg{width:32px;height:32px;display:block}
        .post-fs-heart.empty{color:#fff}
        .post-fs-heart:not(.empty){color:#e32626}
        .post-fs-pill{display:flex;flex-direction:column;width:40px;height:110px;border-radius:28px;overflow:hidden;background:#333}
        .post-fs-pill-liked{background:#8B1A1A;color:#fff;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:12px;font-weight:bold}
        .post-fs-pill-liked .pct{font-size:14px}
        .post-fs-pill-hated{background:#333;color:#fff;min-height:35px;font-size:12px;display:flex;align-items:center;justify-content:center}
        .post-fs-poop{font-size:28px;cursor:pointer;opacity:.55;filter:brightness(1.25);transition:opacity .2s,filter .2s}
        .post-fs-poop.hated{opacity:1;filter:brightness(.4)}
        .post-fs-media-wrap{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:6;touch-action:none}
        .post-fullscreen-media,.post-fullscreen-media video,.post-fullscreen-media img{width:100%;height:100%;object-fit:contain}
        /* The locked tile is a square graphic. Left to the rule above it stretched
           to the full height of the viewer, and object-fit letterboxed the artwork
           inside, so the border framed the empty box instead of the image. */
        .post-fullscreen-media img.post-fs-locked{height:auto;object-fit:fill}
        .post-fs-video-wrap{position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center}
        .post-fs-video-wrap video{width:100%;height:100%;object-fit:contain}
        .post-fs-heart-pop-wrap{position:absolute;inset:0;pointer-events:none;z-index:7}
        .post-fs-heart-pop{position:absolute;transform:translate(-50%,-50%);font-size:80px;line-height:1;color:#e32626;text-shadow:0 0 30px rgba(227,38,38,.8);animation:postFsHeartPop .8s ease-out forwards}
        @keyframes postFsHeartPop{0%{transform:translate(-50%,-50%) scale(0);opacity:.8}15%{transform:translate(-50%,-50%) scale(1.4);opacity:1}30%{transform:translate(-50%,-50%) scale(1.1);opacity:1}100%{transform:translate(-50%,-50%) scale(1.2);opacity:0}}
        .post-fs-report-wrap{position:relative}
        .post-fs-report-btn{background:none;border:none;color:rgba(255,255,255,.9);padding:8px;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center}
        .post-fs-report-menu{position:absolute;top:100%;right:0;margin-top:8px;background:#fff;border:1px solid #ccc;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.15);min-width:180px;z-index:20;list-style:none;margin:0;padding:0;font-size:13px}
        .post-fs-report-menu li{border-bottom:1px solid #eee}
        .post-fs-report-menu li:last-child{border-bottom:none}
        .post-fs-report-menu a{display:block;padding:10px 16px;color:#333;text-decoration:none}
        .post-fs-report-menu a:hover{background:#f5f5f5}
        .post-fs-enter-next{animation:fsEnterNext .3s cubic-bezier(.22,.61,.36,1)}
        .post-fs-enter-prev{animation:fsEnterPrev .3s cubic-bezier(.22,.61,.36,1)}
        @keyframes fsEnterNext{from{transform:translateY(55%);opacity:.4}to{transform:translateY(0);opacity:1}}
        @keyframes fsEnterPrev{from{transform:translateY(-55%);opacity:.4}to{transform:translateY(0);opacity:1}}
        @media (prefers-reduced-motion:reduce){.post-fs-enter-next,.post-fs-enter-prev{animation:none}}
      `}</style>

      {/* Top bar: back + report */}
      <div className="post-fs-topbar">
        {/* Back to wherever the viewer was opened from — the profile, the posts
            grid, the feed — at the scroll position it was left at, not always to
            World. prev/next replace the entry rather than pushing, so one step
            back leaves the reel. Falling back to World covers a direct link,
            where there is nothing behind this page. */}
        <a
          href={worldBack}
          className="post-fs-back"
          title="Back"
          onClick={(e) => {
            e.preventDefault();
            const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
            if (idx > 0) navigate(-1);
            else navigate(worldBack);
          }}
        >
          <BackIcon />
        </a>
        {authUser && (
          <div className="post-fs-report-wrap">
            <button
              type="button"
              className="post-fs-report-btn"
              title="Report"
              onClick={(e) => { e.stopPropagation(); setReportOpen((v) => !v); }}
            >
              <img src={assetImage('arrowDown_.png')} alt="Report" style={{ width: 14, height: 14 }} />
            </button>
            {reportOpen && (
              <ul className="post-fs-report-menu">
                {REPORT_REASONS.map((reason) => (
                  <li key={reason}>
                    <a href="#" onClick={(e) => { e.preventDefault(); e.stopPropagation(); submitReport(reason); }}>
                      {tReport(`reasons.${REASON_KEY[reason]}`, { defaultValue: reason })}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* The up/down arrow buttons are gone at the client's request — prev/next
          is swipe on touch, and wheel or ArrowUp/ArrowDown on desktop. */}

      {/* Media: double-click like, single click mute, swipe / wheel prev-next */}
      <div
        className="post-fs-media-wrap"
        ref={mediaWrapRef}
        onClick={onMediaTap}
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div
          className={`post-fullscreen-media${slideDir.current ? ` post-fs-enter-${slideDir.current}` : ''}`}
          key={post.id}
        >
          {locked ? (
            /* blocked post: locked tile + subscribe/follow CTA (no media) */
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
              <img
                src={LOCKED_POST_IMAGE}
                alt="Locked"
                className="post-fs-locked"
                style={{ width: 220, maxWidth: '60%', borderRadius: 26, border: '7px solid lightgray' }}
              />
              <a
                href={author?.usernameUrl ? `/${author.usernameUrl}` : '#'}
                onClick={(e) => { e.preventDefault(); if (author?.usernameUrl) navigate(`/${author.usernameUrl}`); }}
                style={{ background: '#fff', border: '2px solid #d91e33', color: '#d91e33', borderRadius: 6, padding: '10px 18px', fontSize: 15, fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                <img src="/assets/images/SUPERHEROINA.svg" style={{ width: 22 }} alt="" />
                {author?.role === 'influencer'
                  ? `${tContent('subscribe', { defaultValue: 'Subscribe' })} + ${tContent('to_see_post', { defaultValue: 'to see this post' })} | $${author?.priceOfSubscription ?? ''}`
                  : `${tContent('follow', { defaultValue: 'Follow' })} + ${tContent('to_see_post', { defaultValue: 'to see this post' })}`}
              </a>
            </div>
          ) : media && isVideoFile(media) ? (
            <div className="post-fs-video-wrap">
              <video
                ref={videoRef}
                className="post-fullscreen-media"
                autoPlay
                muted
                loop
                playsInline
                poster={post.thumbnail ? assetImage(`thumbnails/${post.thumbnail}`) : undefined}
              >
                <source src={assetImage(media)} type={videoMime(media)} />
              </video>
            </div>
          ) : (
            <img src={media ? assetImage(media) : LOCKED_POST_IMAGE} alt="Post" className="post-fullscreen-media" />
          )}
        </div>
        <div className="post-fs-heart-pop-wrap">
          {pops.map((p) => (
            <div key={p.id} className="post-fs-heart-pop" style={{ left: p.x, top: p.y }}>
              <HeartIcon size={80} />
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar: avatar + nickname + follow */}
      <div className="post-fs-bottombar">
        <a
          href={`/${author?.usernameUrl ?? ''}`}
          onClick={(e) => { e.preventDefault(); if (author?.usernameUrl) navigate(`/${author.usernameUrl}`); }}
          style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit', flex: 1, minWidth: 0 }}
        >
          <img
            className="post-fs-avatar"
            src={author?.profilePicture ? assetImage(author.profilePicture) : assetImage('SUPERHEROINA.svg')}
            alt=""
          />
          {/* handle over the post's date, per the client's design (the blade has
              the handle only, and prints it as "@ name") */}
          <span className="post-fs-author">
            <span className="post-fs-nickname">@{author?.usernameUrl ?? 'Nickname'}</span>
            <span className="post-fs-date">{postedOn}</span>
          </span>
        </a>
        {authUser && !isOwner && !following && (
          <button type="button" className="post-fs-follow-btn" onClick={follow}>FOLLOW +</button>
        )}
      </div>

      {/* Right rail: heart / %Liked pill / poop — hidden on a locked (blocked) post */}
      {!locked && (
        <div className="post-fs-rightbar">
          <span className={`post-fs-heart${liked ? '' : ' empty'}`} title="Like" onClick={(e) => { e.stopPropagation(); doLike(); }}>
            <HeartIcon />
          </span>
          <div className="post-fs-pill">
            <div className="post-fs-pill-liked">
              <span className="pct">{pct}%</span>
              <span>Liked</span>
            </div>
            <div className="post-fs-pill-hated">{hated ? 'Hated' : 'Hate'}</div>
          </div>
          <span
            className={`post-fs-poop${hated ? ' hated' : ''}`}
            title={hated ? 'Hated' : 'Hate'}
            onClick={(e) => { e.stopPropagation(); doHate(); }}
          >
            💩
          </span>
        </div>
      )}

      <audio ref={likeSound} src="/assets/music/coin-sound.mp3" />
      <audio ref={hateSound} src="/assets/music/woosh-260275.mp3" />

      {swal && <SwalResult {...swal} onClose={() => setSwal(null)} />}
    </div>
  );
}
