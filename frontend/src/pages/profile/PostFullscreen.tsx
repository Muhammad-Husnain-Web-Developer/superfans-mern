import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { assetImage, isVideoFile, likePercent, videoMime } from '../../utils/format';
import { playHateSound, playLikeSound } from '../../utils/postSounds';
import { LOCKED_POST_IMAGE } from '../../utils/networkLogo';
import { useAuth } from '../../context/AuthContext';
import { SwalResult } from './Profile';
import { SubscribeModal } from './SubscribeModal';
import { RatingPill } from '../../components/RatingPill';
import '../../styles/report-menu.css';

/**
 * The viewer's own click, kept in the browser beside the server's record of it — the client's
 * "mini-cookies for FULL SCREEN saving the clicked animation (not hard restart bar)".
 *
 * The server is still what a vote *is*; this only holds the answer steady in the moment
 * before it replies, and across a reload, so the bar is never handed back at rest after the
 * viewer has already moved it.
 *
 * Only the two flags are kept — the counts belong to everyone, and this is one viewer's
 * browser. Two hundred posts is far more than a session walks through, and the oldest fall
 * off the end so the entry can never grow without limit.
 */
const VOTE_STORE = 'sf_post_votes';
const VOTES_KEPT = 200;
type Vote = { liked: boolean; hated: boolean };

function readVotes(): Record<string, Vote> {
  try {
    const raw = localStorage.getItem(VOTE_STORE);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, Vote>) : {};
  } catch {
    /* a private window, a full quota, storage switched off: the server still remembers */
    return {};
  }
}

function writeVote(id: string, vote: Vote) {
  try {
    const all = readVotes();
    /* deleted first so a re-vote moves to the end: insertion order is the age used below */
    delete all[id];
    if (vote.liked || vote.hated) all[id] = vote;
    const ids = Object.keys(all);
    for (const oldest of ids.slice(0, Math.max(0, ids.length - VOTES_KEPT))) delete all[oldest];
    localStorage.setItem(VOTE_STORE, JSON.stringify(all));
  } catch {
    /* as above — losing the note costs nothing, the vote itself is already sent */
  }
}

interface FsPost {
  id: string;
  imageVideo: string | null;
  thumbnail: string | null;
  likesTotal: number;
  likePercent?: number | null;
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

/**
 * Full-screen "reels" post viewer — port of user/post_detail.blade.php
 * (/user/post_detail/:id, /influencer/post_detail/:id). Black full-bleed media with a
 * grey top bar (back + report), a bottom bar (avatar · @nick · +Follow) and a right rail
 * (heart · %Liked/Hate pill · 💩). Double-click likes with a heart pop; single click mutes
 * the video; vertical swipe moves prev/next.
 */
export function PostFullscreen() {
  const { t: tUi } = useTranslation('ui');
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  // World context: full-screen scroll follows the WORLD feed order (passed via router state),
  // not the influencer's own posts. Absent → fall back to the backend's sibling prev/next.
  const worldSeq = (location.state as { world?: string[] } | null)?.world ?? null;
  /* an ad for a paid creator sends the viewer here with the payment dialog already asked
     for: "Full Screen + Modal Payment. But they can close the modal to see the post and
     they have the Subscribe button beside Nickname." */
  const askSubscribe = (location.state as { subscribe?: boolean } | null)?.subscribe === true;
  const { t: tReport } = useTranslation('report');
  const { t: tContent, i18n } = useTranslation('content');
  const { user: authUser } = useAuth();

  const [post, setPost] = useState<FsPost | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'notfound'>('loading');
  /* opened straight from what this browser remembers, so the bar is already where the viewer
     left it on the very first paint rather than at rest — the server's answer, a moment
     later, is still the one that stands */
  const [liked, setLiked] = useState(() => readVotes()[id]?.liked ?? false);
  const [hated, setHated] = useState(() => readVotes()[id]?.hated ?? false);
  const [likes, setLikes] = useState(0);
  const [hates, setHates] = useState(0);
  const [following, setFollowing] = useState(false);
  /* a paid creator is subscribed to, not followed — same button, different word and a
     different road behind it */
  const [subOpen, setSubOpen] = useState(askSubscribe);
  const [subBusy, setSubBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [swal, setSwal] = useState<{ icon?: 'success' | 'error'; title: string; text?: string } | null>(null);
  /* Expanded: the media alone, every control out of the way. Tied to the
     browser's own full screen so Escape (and the phone's back gesture) is the
     way out -- the client asked for no controls to be left on screen. */
  const [expanded, setExpanded] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
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

  /**
   * Both places the viewer's click has to land, or swiping away and back undoes it on screen.
   *
   * The warmed copy in `cache` is the one the viewer is handed when they come back to a post,
   * and it was fetched before they voted — left alone, it reports them as never having
   * touched it. The browser store is the other half, for a reload or the next day.
   */
  function keepVote(vote: Vote, counts?: { likes: number; hates: number }) {
    writeVote(id, vote);
    const cached = cache.current.get(id);
    if (!cached) return;
    cache.current.set(id, {
      ...cached,
      viewerLiked: vote.liked,
      viewerHated: vote.hated,
      ...(counts ? { likesCount: counts.likes, hatesCount: counts.hates } : {}),
    });
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
        /* the server has the last word: a vote cast on another device, or taken back there,
           corrects the note this browser was keeping */
        writeVote(d.id, { liked: d.viewerLiked, hated: d.viewerHated });
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

  /**
   * Start every clip with its sound on — the client does not want to tap for it.
   *
   * A browser will not autoplay a loud video unless the page has been
   * interacted with. Arriving here from the feed counts, since the tap that
   * opened the post lands on this same document; opening the URL cold does not.
   * So it asks for sound first and, only if that is refused, falls back to a
   * muted playback and lifts the mute on the reader's next touch — which is
   * better than a video that sits still.
   */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    let cancelled = false;
    /* only the mute is ours to set — the volume is the reader's, and it already
       starts at full */
    v.muted = false;

    void v.play().catch(() => {
      /* refused for being loud — play it quietly rather than not at all. The
         tap that already toggles the sound lifts this, so nothing extra
         listens for it and nothing fights that toggle. */
      if (cancelled) return;
      v.muted = true;
      void v.play().catch(() => {});
    });

    return () => {
      cancelled = true;
    };
  }, [post?.id]);

  useEffect(() => {
    const onChange = () => setExpanded(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  function toggleExpanded() {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
      return;
    }
    /* if the browser refuses, still clear the controls so the tap does something */
    void document.documentElement.requestFullscreen().catch(() => setExpanded(true));
  }

  /* The viewer used to hold its own two <audio> elements. The like sound is now a run of
     eleven the client set out, and it has to carry across the whole app rather than restart
     here — so both sounds come from the same helpers the walls use. */
  function playLike() {
    playLikeSound();
  }
  function playHate() {
    playHateSound();
  }

  // function doLike(skipSound?: boolean) {
  //   if (!post) return;
  //   api
  //     .post<{ success: boolean; data: { status: string; likesCount: number; hatesCount: number } }>(
  //       `/posts/${post.id}/like-toggle`,
  //     )
  //     .then((r) => {
  //       const nowLiked = r.data.data.status === 'post liked';
  //       setLiked(nowLiked);
  //       if (nowLiked) setHated(false);
  //       setLikes(r.data.data.likesCount);
  //       setHates(r.data.data.hatesCount);
  //       if (!skipSound) playLike();
  //     })
  //     .catch(() => undefined);
  // }

  // function doHate() {
  //   if (!post) return;
  //   api
  //     .post<{ success: boolean; data: { status: string; likesCount: number; hatesCount: number } }>(
  //       `/me/hate/${post.id}`,
  //     )
  //     .then((r) => {
  //       const nowHated = r.data.data.status === 'post hated';
  //       setHated(nowHated);
  //       if (nowHated) setLiked(false);
  //       setLikes(r.data.data.likesCount);
  //       setHates(r.data.data.hatesCount);
  //       playHate();
  //     })
  //     .catch(() => undefined);
  // }
function doLike(skipSound?: boolean) {
  if (!post) return;
  if (!skipSound) playLike();

  const willBeLiked = !liked;
  setLiked(willBeLiked);
  if (willBeLiked) {
    setHated(false);
    setLikes((prev) => prev + 1);
    if (hated) setHates((prev) => prev - 1);
  } else {
    setLikes((prev) => prev - 1);
  }
  keepVote({ liked: willBeLiked, hated: willBeLiked ? false : hated });

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
      keepVote(
        { liked: nowLiked, hated: nowLiked ? false : hated },
        { likes: r.data.data.likesCount, hates: r.data.data.hatesCount },
      );
    })
    .catch((err) => {
        // If 401, keep the optimistic state – interceptor will retry
      if (err?.response?.status === 401) {
        console.log('🔄 Token expired – keeping optimistic state');
        return;
      }
      setLiked(!willBeLiked);
      if (willBeLiked) {
        setLikes((prev) => prev - 1);
        if (hated) setHates((prev) => prev + 1);
      } else {
        setLikes((prev) => prev + 1);
      }
      keepVote({ liked: !willBeLiked, hated });
    });
}
function doHate() {
  if (!post) return;
  playHate();

  const willBeHated = !hated;
  setHated(willBeHated);
  if (willBeHated) {
    setLiked(false);
    setHates((prev) => prev + 1);
    if (liked) setLikes((prev) => prev - 1);
  } else {
    setHates((prev) => prev - 1);
  }
  keepVote({ liked: willBeHated ? false : liked, hated: willBeHated });

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
      keepVote(
        { liked: nowHated ? false : liked, hated: nowHated },
        { likes: r.data.data.likesCount, hates: r.data.data.hatesCount },
      );
    })
    .catch((err) => {
        // If 401, keep the optimistic state – interceptor will retry
      if (err?.response?.status === 401) {
        console.log('🔄 Token expired – keeping optimistic state');
        return;
      }
      setHated(!willBeHated);
      if (willBeHated) {
        setHates((prev) => prev - 1);
        if (liked) setLikes((prev) => prev + 1);
      } else {
        setHates((prev) => prev + 1);
      }
      keepVote({ liked, hated: !willBeHated });
    });
}
  /* Straight to the same Stripe checkout the profile's own Follow opens
     (Profile.tsx:1199); the modal in front of it is the same one too. */
  function subscribe() {
    if (!post?.influencer || subBusy) return;
    setSubBusy(true);
    api
      .post<{ url?: string }>(`/payments/subscribe/${post.influencer.id}`)
      .then(({ data }) => {
        if (data.url) window.location.href = data.url;
        else setSubBusy(false);
      })
      .catch(() => {
        setSubBusy(false);
        setSwal({ icon: 'error', title: tUi('something_went_wrong') });
      });
  }

  function follow() {
    if (!post?.influencer) return;
    api
      .post(`/me/follow/${post.influencer.id}`)
      .then(() => {
        setFollowing(true);
        setSwal({ title: tUi('followed_successfully') });
      })
      .catch(() => setSwal({ icon: 'error', title: tUi('something_went_wrong') }));
  }

  /* The client asked for a share row at the head of the report list. It copies this
     page's own address: /post/:id renders the old sidebar detail page instead of the
     reel, and greets a signed-out visitor with a Login link, while this route opens
     the same full-screen view for everyone, guests included. */
  function copyPostLink() {
    if (!post) return;
    setReportOpen(false);
    const write = navigator.clipboard?.writeText(`${window.location.origin}/user/post_detail/${post.id}`);
    if (!write) {
      setSwal({ icon: 'error', title: tReport('share.failed') });
      return;
    }
    void write
      .then(() => setSwal({ icon: 'success', title: tReport('share.copied') }))
      .catch(() => setSwal({ icon: 'error', title: tReport('share.failed') }));
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
        <p>{tUi('not_found')}</p>
      </div>
    );
  }

  const media = post.imageVideo;
  const author = post.influencer;
  /* the same test the profile makes (Profile.tsx:1183): a creator with a price is
     subscribed to; everyone else — free creators and normal users — is followed */
  const isPaidCreator = author?.role === 'influencer' && (author?.priceOfSubscription ?? 0) > 0;
  const isOwner = !!authUser && author?.id === authUser.id;
  const worldBack = authUser?.role === 'influencer' ? '/influencer/world' : '/user/world';
  const pct = likePercent(likes, hates, post?.likePercent, {
    id: post?.id,
    views: post?.likesTotal,
  });
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
        /* The bar itself is see-through now, at the client's request; the grey
           it used to carry moved onto the report control alone. */
        .post-fs-topbar{position:absolute;top:0;left:0;right:0;height:52px;background:transparent;display:flex;align-items:center;justify-content:space-between;padding:0 16px;z-index:10}
        .post-fs-report-wrap{background:none}
        /* the client's own arrow, 31x30 — drawn at its natural size */
        .post-fs-back{color:#fff;display:flex;align-items:center;justify-content:center;text-decoration:none;padding:4px;font-size:14px}
        .post-fs-back:hover,.post-fs-back:focus{color:#fff;text-decoration:none}
        .post-fs-bottombar{position:absolute;bottom:0;left:0;right:0;min-height:72px;display:flex;align-items:center;padding:12px 16px;gap:4px;z-index:10}
        .post-fs-avatar{width:48px;height:48px;border-radius:50%;object-fit:cover;background:#555;flex-shrink:0}
        .post-fs-author{display:flex;flex-direction:column;justify-content:center;min-width:0;flex:1;gap:2px}
        .post-fs-nickname{color:#fff;font-weight:700;font-size:17px;line-height:1.1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .post-fs-date{color:#fff;font-size:12px;line-height:1.1;opacity:.85}
        /* dressed as the @nickname tag that sits above every post
           (.feed_posts_heading_p): darkgray ground, black text, the same
           lightgray edge that is thinner along the bottom, and Consolas */
      .post-fs-follow-btn{background:#c3c3c3 !important;color:#000;border:5px solid #585858 !important;border-radius:0;padding:5px 10px;font:900 14px Consolas,Menlo,Monaco,monospace;white-space:nowrap;flex-shrink:0;cursor:pointer;
      margin-left:5px;}
        /* flex:0 1 auto, not flex:1 -- growing would take all the free width and
           shove FOLLOW against the far edge, half a bar away from the name it
           belongs to. It still shrinks, so a long nickname ellipsises. */
        .post-fs-authorlink{display:flex;align-items:center;gap:12px;text-decoration:none;color:inherit;min-width:0;flex:0 1 auto}
        /* the page's own a:hover underlines every link; the handle is not one to underline */
        .post-fs-authorlink:hover,.post-fs-authorlink:focus{text-decoration:none;color:inherit}
        /* the expand control sits in the bottom-right corner, clear of the
           bottom bar; while expanded it is the only thing left on screen so
           there is a way back */
        /* translateZ puts this on its own compositing layer. A playing video is
           handed to the GPU as an overlay plane, and anything left on the normal
           layer can be painted underneath it however high its z-index -- which is
           why the control vanished a second into every video, once playback took
           over, and only on video posts. */
        .post-fs-expand{position:absolute;right:16px;bottom:12px;z-index:11;background:none;border:none;color:#fff;font-size:20px;padding:8px;cursor:pointer;opacity:.9;transform:translateZ(0);will-change:transform}
        /* 12px is the bottom bar's own padding, so this lands on the same row as the
           handle and FOLLOW instead of hanging below them. */
        .post-fs-expand:hover{opacity:1}
        .post-fs-rightbar{position:absolute;right:0;bottom:96px;display:flex;flex-direction:column;align-items:center;gap:16px;padding:16px 12px;z-index:10}
        /* FOLLOW now sits beside the nickname rather than in the corner, so the
           expand control keeps the corner on a phone as well. The reserved right
           padding stops a long nickname from pushing FOLLOW underneath it. */
        @media (max-width:768px){
          .post-fs-bottombar{padding-right:60px}
        }
        .post-fs-media-wrap{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:6;touch-action:none}
        .post-fullscreen-media,.post-fullscreen-media video,.post-fullscreen-media img{width:100%;height:100%;object-fit:contain}
        /* The locked tile is a square graphic. Left to the rule above it stretched
           to the full height of the viewer, and object-fit letterboxed the artwork
           inside, so the border framed the empty box instead of the image. */
        .post-fullscreen-media img.post-fs-locked{height:auto;object-fit:fill}
        .post-fs-video-wrap{position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center}
        /* A playing video is handed to the GPU as an overlay plane, which paints
           over page content no matter its z-index -- so the expand control was
           swallowed wherever the picture reached the corner, i.e. on full-width
           videos but not on portrait ones with black bars beside them. An opacity
           below 1 makes the frame ineligible for that plane and sends it back
           through normal compositing, where z-index is respected again. .999 is
           indistinguishable on screen. */
        .post-fs-video-wrap video{width:100%;height:100%;object-fit:contain;opacity:.999}
        .post-fs-heart-pop-wrap{position:absolute;inset:0;pointer-events:none;z-index:7}
        .post-fs-heart-pop{position:absolute;transform:translate(-50%,-50%);font-size:80px;line-height:1;color:#e32626;text-shadow:0 0 30px rgba(227,38,38,.8);animation:postFsHeartPop .8s ease-out forwards}
        @keyframes postFsHeartPop{0%{transform:translate(-50%,-50%) scale(0);opacity:.8}15%{transform:translate(-50%,-50%) scale(1.4);opacity:1}30%{transform:translate(-50%,-50%) scale(1.1);opacity:1}100%{transform:translate(-50%,-50%) scale(1.2);opacity:0}}
        .post-fs-report-wrap{position:relative}
        .post-fs-report-btn{background:none;border:none;color:rgba(255,255,255,.9);width:28px;height:28px;padding:0;line-height:1;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center}
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
      {!expanded && <div className="post-fs-topbar">
        {/* Back to wherever the viewer was opened from — the profile, the posts
            grid, the feed — at the scroll position it was left at, not always to
            World. prev/next replace the entry rather than pushing, so one step
            back leaves the reel. Falling back to World covers a direct link,
            where there is nothing behind this page. */}
        <a
          href={worldBack}
          className="post-fs-back"
          title={tUi('back')}
          onClick={(e) => {
            e.preventDefault();
            const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
            if (idx > 0) navigate(-1);
            else navigate(worldBack);
          }}
        >
          {/* the client asked for the plain white arrow again, from Font Awesome,
              in place of the purple artwork */}
          <i className="fas fa-chevron-left" aria-hidden="true"></i>
        </a>
        {authUser && (
          <div className="post-fs-report-wrap">
            <button
              type="button"
              className="post-fs-report-btn"
              title={tUi('report')}
              onClick={(e) => { e.stopPropagation(); setReportOpen((v) => !v); }}
            >
              {/* Font Awesome in place of assets/images/arrowDown_.png, and a caret
                  rather than a chevron: that image was a solid filled triangle,
                  which is the shape the client wants kept. */}
              <i className="fas fa-caret-down" aria-hidden="true"></i>
            </button>
            {reportOpen && (
              <ul className="post-fs-report-menu">
                <li>
                  <a href="#" onClick={(e) => { e.preventDefault(); e.stopPropagation(); copyPostLink(); }}>
                    📤 {tReport('share.post')}
                  </a>
                </li>
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
      </div>}

      <button
        type="button"
        className="post-fs-expand"
        title={expanded ? tUi('exit_full_screen') : tUi('full_screen')}
        onClick={(e) => { e.stopPropagation(); toggleExpanded(); }}
      >
        <i className={`fas fa-${expanded ? 'compress' : 'expand'}`} aria-hidden="true"></i>
      </button>

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
                alt={tUi('alt_locked')}
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
              {/* no `muted`: the client wants the sound on from the first frame,
                  without the tap it used to take. The effect above puts it back
                  only if the browser refuses to start a loud video. */}
              <video
                ref={videoRef}
                className="post-fullscreen-media"
                autoPlay
                loop
                playsInline
                poster={post.thumbnail ? assetImage(`thumbnails/${post.thumbnail}`) : undefined}
              >
                <source src={assetImage(media)} type={videoMime(media)} />
              </video>
            </div>
          ) : (
            <img src={media ? assetImage(media) : LOCKED_POST_IMAGE} alt={tUi('alt_post')} className="post-fullscreen-media" />
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
      {!expanded && <div className="post-fs-bottombar">
        <a
          href={`/${author?.usernameUrl ?? ''}`}
          onClick={(e) => { e.preventDefault(); if (author?.usernameUrl) navigate(`/${author.usernameUrl}`); }}
          className="post-fs-authorlink"
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
          <button
            type="button"
            className="post-fs-follow-btn"
            onClick={isPaidCreator ? () => setSubOpen(true) : follow}
          >
            {isPaidCreator ? tUi('subscribe_plus') : tUi('follow_plus')}
          </button>
        )}
      </div>}

      {/* the profile's own subscribe dialog, which is what leads to the payment */}
      {author?.usernameUrl && (
        <SubscribeModal
          usernameUrl={author.usernameUrl}
          open={subOpen}
          busy={subBusy}
          onClose={() => setSubOpen(false)}
          onConfirm={subscribe}
        />
      )}

      {/* Right rail — hidden on a locked (blocked) post. The group itself is the walls' own
          (RatingPill), stood up: the client asked for one design in both places. */}
      {!locked && !expanded && (
        <div className="post-fs-rightbar">
          <RatingPill
            orientation="vertical"
            pct={pct}
            liked={liked}
            hated={hated}
            onLike={doLike}
            onHate={doHate}
          />
        </div>
      )}


      {swal && <SwalResult {...swal} onClose={() => setSwal(null)} />}
    </div>
  );
}
