import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { fetchProfile, fetchProfilePosts, type ProfileData, type ProfilePost } from '../../api/profiles';
import { assetImage, formatNumber, formatNumberRounded, formatPrice, isVideoFile, likePercent, videoMime } from '../../utils/format';
import { LOCKED_POST_IMAGE, networkLogo } from '../../utils/networkLogo';
import { observeNewVideos } from '../../utils/video';
import { useAuth } from '../../context/AuthContext';
import { usePaymentReturn } from '../../utils/usePaymentReturn';
import { GuestHeader, ProfileSidebar } from './ProfileSidebar';
import { AddPostModal } from './AddPostModal';
import { SwalResult } from '../../components/SwalResult';
import { AddPostHost } from './AddPostHost';
import { ControlPanelHost } from './ControlPanelHost';
import { AddStoryModal } from '../../components/stories/AddStoryModal';
import { StoryViewer } from '../../components/stories/StoryViewer';
import { fetchUserStories } from '../../api/stories';
import '../../styles/stories.css';
import { ControlPanelModal } from './ControlPanelModal';
import { UserModalCenter } from './UserModalCenter';
import { InfluencerControlPanelModal } from './InfluencerControlPanelModal';
import { VolumeButton } from '../../components/VolumeButton';
import { PostReportButton } from '../../components/PostReportButton';
import { useRegisterModal } from '../../components/RegisterModal';
import { PageLoader } from '../../components/PageLoader';
import { PostHeading } from '../../components/PostHeading';
import { RatingPill } from '../../components/RatingPill';
import { useRatingFeedback } from '../../utils/useRatingFeedback';
import { rememberScroll, useScrollMemory } from '../../utils/useScrollMemory';
import { NotFoundPage } from '../errors/ErrorPage';
import { NavToggle } from '../../components/NavToggle';
import { MobileFooterMenu } from '../../components/MobileFooterMenu';
import { localeLogo } from '../auth/AuthShell';
import '../../styles/profile-page.css';
import { useLayoutPageStyles } from '../../components/StandalonePage';
import { SubscriberListModal } from './SubscriberListModal';
import { SubscribeModal } from './SubscribeModal';
import { PremiumFanModal } from '../../components/PremiumFanModal';
import { ChatWithModal } from './ChatWithModal';

/** Bio with newlines → line breaks (nl2br) and @mentions linked, as the Blade page does. */
export function Bio({ bio }: { bio: string }) {
  const lines = bio.split(/\r?\n/);
  return (
    <div style={{ maxWidth: '100%', wordWrap: 'break-word' }}>
      <p style={{ color: 'gray', marginBottom: 5 }}>
        {lines.map((line, li) => (
          <span key={li}>
            {li > 0 && <br />}
            {line.split(/(@\w+)/g).map((part, i) =>
              part.startsWith('@') ? (
                <Link key={i} to={`/${part.slice(1)}`} style={{ color: '#007bff' }}>
                  {part}
                </Link>
              ) : (
                <span key={i}>{part}</span>
              ),
            )}
          </span>
        ))}
      </p>
    </div>
  );
}

/* report.reasons.* keys — the dropdown shows the full descriptive label from report.json
   (matching Laravel's user-report options), and reports the same descriptive text. */
/* still exported from here: four pages import it by this path. */
export { SwalResult };

const REPORT_REASONS = ['sensuality', 'impersonation', 'violence', 'racism', 'other'] as const;

/* How long the Boost Your Post modal stays away once it has been shown. */
const BOOST_QUIET_SECONDS = 11 * 60;
const boostCookie = (usernameUrl: string) => `sf_boost_seen_${encodeURIComponent(usernameUrl)}`;

function boostRecentlyShown(usernameUrl: string): boolean {
  const name = boostCookie(usernameUrl);
  return document.cookie.split('; ').some((c) => c.startsWith(`${name}=`));
}

/* The cookie expires on its own after 11 minutes; nothing has to clear it. */
function markBoostShown(usernameUrl: string): void {
  document.cookie = `${boostCookie(usernameUrl)}=1; max-age=${BOOST_QUIET_SECONDS}; path=/; SameSite=Lax`;
}

export function PostItem({
  post,
  locked,
  showReport = false,
  author,
}: {
  post: ProfilePost;
  locked: boolean;
  /* Laravel shows the per-post report control on the POSTS grid and the feed, but not on
     the profile WALL/activity view — so it is opt-in. */
  showReport?: boolean;
  /** whose wall this is — its handle heads every post, as in the world feed */
  author?: { usernameUrl: string; profilePicture: string | null; verified?: boolean };
}) {
  const { t: tUi } = useTranslation('ui');
  const media = post.imageVideo;
  const navigate = useNavigate();
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* pair each tag with its avatar by position. The blade drops a handle whose
     avatar is missing; the client wants the nickname on every post, so only the
     name is required and the avatar is optional. */
  const taggedPairs = (post.tags ?? [])
    .map((name, i) => [name.trim(), (post.taggedProfilePictures?.[i] ?? '').trim()] as const)
    .filter(([name]) => name);
  const [heart, setHeart] = useState(false);
  /* the eye is the view count now, not the like count (David, 1 Oct 2026); the fallback keeps
     the old figure if a payload has not been updated rather than dropping it to zero. A like
     no longer moves it, which is why nothing here sets it. */
  const [views] = useState(post.views ?? post.noOfLikes);
  /* the pill's own counts: real rows only, kept apart from the view figure above */
  const [liked, setLiked] = useState(post.viewerLiked ?? false);
  const [hated, setHated] = useState(post.viewerHated ?? false);
  const [likeRows, setLikeRows] = useState(post.likesCount ?? 0);
  const [hateRows, setHateRows] = useState(post.hatesCount ?? 0);
  /* blade: the coin + heartbeat on a like, the woosh + poop bounce on a hate */
  const feedback = useRatingFeedback();
  const frame: React.CSSProperties = {
    borderRadius: 26,
    border: '7px solid lightgray',
    width: '100%',
    /* the handle strip is positioned and overlaps the top of the media, so the
       media has to paint over it — otherwise the strip sits on the post instead
       of tucking behind it (videos already got this from their wrapper) */
    position: 'relative',
    zIndex: 1,
  };

  /* Blade behavior: single click (350ms) opens the full-screen viewer
     (/user/post_detail/:id, per user_posts/feed/activity blades), double click likes. */
  function onMediaClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      setHeart(true);
      setTimeout(() => setHeart(false), 600);
      /* A double-click only ever likes — it never takes a like back. The viewer behaves
         this way already (PostFullscreen.onMediaTap), and these cards used to toggle, so
         the same gesture gave opposite results on the two screens and a second accidental
         double-click quietly dropped the like. Undoing one is the pill's own job. The
         heart and the sound still answer every double-click, liked or not. */
      if (liked) feedback.onLiked();
      else doLike();
    } else {
      /* noted in the click itself, not inside the timer: by the time the
         double-click window closes the page has been laid out for the viewer
         and the position reads 0 */
      rememberScroll(); // so closing the viewer returns to this row
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null;
        navigate(`/user/post_detail/${post.id}`);
      }, 350);
    }
  }

  // function doLike() {
  //   api
  //     .post<{ success: boolean; data: { status: string; likesTotal: number; likesCount: number; hatesCount: number } }>(
  //       `/posts/${post.id}/like-toggle`,
  //     )
  //     .then((r) => {
  //       const nowLiked = r.data.data.status === 'post liked';
  //       setLiked(nowLiked);
  //       if (nowLiked) setHated(false);
  //   //       setLikeRows(r.data.data.likesCount);
  //       setHateRows(r.data.data.hatesCount);
  //       feedback.onLiked();
  //     })
  //     .catch(() => undefined);
  // }

  // function doHate() {
  //   api
  //     .post<{ success: boolean; data: { status: string; likesCount: number; hatesCount: number } }>(
  //       `/me/hate/${post.id}`,
  //     )
  //     .then((r) => {
  //       const nowHated = r.data.data.status === 'post hated';
  //       setHated(nowHated);
  //       if (nowHated) setLiked(false);
  //       setLikeRows(r.data.data.likesCount);
  //       setHateRows(r.data.data.hatesCount);
  //       feedback.onHated();
  //     })
  //     .catch(() => undefined);
  // }
function doLike() {
  feedback.onLiked();

  const willBeLiked = !liked;
  setLiked(willBeLiked);
  if (willBeLiked) {
    setHated(false);
    setLikeRows((prev) => prev + 1);
    if (hated) setHateRows((prev) => prev - 1);
  } else {
    setLikeRows((prev) => prev - 1);
  }

  api
    .post<{ success: boolean; data: { status: string; likesTotal: number; likesCount: number; hatesCount: number } }>(
      `/posts/${post.id}/like-toggle`,
    )
    .then((r) => {
      const nowLiked = r.data.data.status === 'post liked';
      setLiked(nowLiked);
      if (nowLiked) setHated(false);
      setLikeRows(r.data.data.likesCount);
      setHateRows(r.data.data.hatesCount);
    })
    .catch((err) => {
        // If 401, keep the optimistic state – interceptor will retry
      if (err?.response?.status === 401) {
        console.log('🔄 Token expired – keeping optimistic state');
        return;
      }
      setLiked(!willBeLiked);
      if (willBeLiked) {
        setLikeRows((prev) => prev - 1);
        if (hated) setHateRows((prev) => prev + 1);
          } else {
        setLikeRows((prev) => prev + 1);
          }
    });
}
function doHate() {
  feedback.onHated();

  const willBeHated = !hated;
  setHated(willBeHated);
  if (willBeHated) {
    setLiked(false);
    setHateRows((prev) => prev + 1);
    if (liked) setLikeRows((prev) => prev - 1);
  } else {
    setHateRows((prev) => prev - 1);
  }

  api
    .post<{ success: boolean; data: { status: string; likesCount: number; hatesCount: number } }>(
      `/me/hate/${post.id}`,
    )
    .then((r) => {
      const nowHated = r.data.data.status === 'post hated';
      setHated(nowHated);
      if (nowHated) setLiked(false);
      setLikeRows(r.data.data.likesCount);
      setHateRows(r.data.data.hatesCount);
    })
    .catch((err) => {
        // If 401, keep the optimistic state – interceptor will retry
      if (err?.response?.status === 401) {
        console.log('🔄 Token expired – keeping optimistic state');
        return;
      }
      setHated(!willBeHated);
      if (willBeHated) {
        setHateRows((prev) => prev - 1);
        if (liked) setLikeRows((prev) => prev + 1);
      } else {
        setHateRows((prev) => prev + 1);
      }
    });
}
  return (
    <div className="col-md-4 col-sm-6 col-xs-6 col-xxs-12 work-item image-hover-wrapper" style={{ position: 'relative' }}>
      <div className={`animated-heart${heart ? ' show' : ''}`} id={`heart-${post.id}`}></div>
      {/* Every post is headed by its author's handle, then anyone tagged in it —
          the shape the world feed uses. The blade only ever printed the tagged
          handles here, and dropped the strip entirely when there were none. */}
      <PostHeading
        author={author ? { ...author, verified: author.verified } : null}
        tagged={taggedPairs.map(([usernameUrl, profilePicture]) => ({ usernameUrl, profilePicture }))}
      />
      {/* only the media opens the viewer — the handle strip above it and the rating row
          below are not the post, and clicking those used to open it too */}
      <div style={{ position: 'relative', width: '100%', cursor: 'pointer' }} onClick={onMediaClick}>
      {locked || !media ? (
        <img src={LOCKED_POST_IMAGE} alt={tUi('alt_portfolio')} className="img-responsive" style={frame} />
      ) : isVideoFile(media) ? (
        <div className="video-wrapper" style={{ position: 'relative', width: '100%' }}>
          <video
            className="autoplay-video"
            id={`video-${post.id}`}
            style={{ maxWidth: '100%', ...frame }}
            loop
            muted
            playsInline
            poster={post.thumbnail ? assetImage(`thumbnails/${post.thumbnail}`) : undefined}
          >
            <source src={assetImage(media)} type={videoMime(media)} />
          </video>
          <VolumeButton videoId={`video-${post.id}`} />
        </div>
      ) : (
        <img src={assetImage(media)} alt={tUi('alt_portfolio')} className="img-responsive" style={frame} />
      )}
      </div>
      {/* views on the left, the rating group on the right — the horizontal wall row
          the client asked for, the same one the world feed carries */}
      <div className="stats-wrapper has-actions" onClick={(e) => e.stopPropagation()}>
        <div className="view-count">
          <span className="eye-icon">👁️</span>
          <span className="number_of_post_likes">{formatNumberRounded(views)}</span>
        </div>
        {!locked && (
          <RatingPill
            pct={likePercent(likeRows, hateRows, post.likePercent, {
              id: post.id,
              views: post.views ?? post.noOfLikes,
            })}
            liked={liked}
            hated={hated}
            beat={feedback.beat}
            bounce={feedback.bounce}
            onLike={doLike}
            onHate={doHate}
          />
        )}
      </div>
      {showReport && !locked && media && <PostReportButton postId={post.id} />}
    </div>
  );
}

/**
 * Public profile page — port of user_profile.blade.php (vanity URL fallback route).
 */
export function Profile({ wallVariant = false }: { wallVariant?: boolean } = {}) {
  useLayoutPageStyles();
  /* /user and /influencer render the viewer's own wall in place — Laravel keeps
     those URLs rather than redirecting to /{username}, so there is no param there.
     Those pages also use layouts.main, whose control panel is the fuller #userModalCenter
     (wallVariant), while the canonical /{username} profile uses the layouts_direct_user one. */
  const { t: tReport } = useTranslation('report');
  const { t: tUi, i18n } = useTranslation('ui');
  const { usernameUrl: routeUsername } = useParams();
  const { t } = useTranslation('content');
  const { user: authUser } = useAuth();
  const usernameUrl = routeUsername ?? authUser?.usernameUrl ?? '';
  const registerModal = useRegisterModal();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [state, setState] = useState<'loading' | 'ok' | 'notfound' | 'suspended' | 'deleted'>(
    'loading',
  );
  /* the wall already recorded where it was when a post was opened; without this
     it never played the position back, and every return started at the top */
  useScrollMemory(state === 'ok' && posts.length > 0);
  const [reportOpen, setReportOpen] = useState(false);
  const [addPostOpen, setAddPostOpen] = useState(false);
  const [addStoryOpen, setAddStoryOpen] = useState(false);
  const [storyOpen, setStoryOpen] = useState(false);
  /* whether this profile has a story running right now — it decides the ring (Pas 5) */
  const [hasStory, setHasStory] = useState(false);
  const [controlPanelOpen, setControlPanelOpen] = useState(false);
  const [swal, setSwal] = useState<{ icon: 'success' | 'error'; title: string; text: string } | null>(null);
  const [boostOpen, setBoostOpen] = useState(false);
  const [subListOpen, setSubListOpen] = useState(false);
  const boostShownRef = useRef(false);
  const [referralOpen, setReferralOpen] = useState(false);
  const [referralUsername, setReferralUsername] = useState('');
  const referralShownRef = useRef(false);

  const referralPendingRef = useRef(false);

  /* Prepare the one-shot "invite a friend" flag flashed on login (#referralModal). It is
     shown AFTER the boost modal (Laravel order), or on its own when there is no boost. */
  useEffect(() => {
    if (referralShownRef.current || !wallVariant || !profile) return;
    if (authUser?.usernameUrl !== profile.usernameUrl) return;
    const u = sessionStorage.getItem('referralUsername');
    if (!u) return;
    referralShownRef.current = true;
    sessionStorage.removeItem('referralUsername');
    setReferralUsername(u);
    referralPendingRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallVariant, profile, authUser]);

  /* Boost modal first (#boostlatest-postModal, normal-user wall with a latest post); if there
     is no boost, fall through to the pending referral modal. */
  useEffect(() => {
    if (boostShownRef.current || !wallVariant || !profile) return;
    if (authUser?.usernameUrl !== profile.usernameUrl) return;
    /* David, 1 Oct 2026: "Add modal on CREATORS Influencer Accounts". Laravel only ever
       had it on the fan wall — #boostlatest-postModal lives in user/index.blade.php and the
       influencer wall blade has no copy — so the `role === 'user'` test was a faithful port,
       and widening it here is his change, not a fix. A creator has more reason to boost a
       post than a fan does. */
    /* David, 6 Oct 2026: "Set cookies for don't show this Modal more than 11 minutes if we
       refresh". Once shown, a cookie holds it back for 11 minutes, refreshes included. Keyed
       to the account, so a second account on the same browser still gets its own. */
    const hasBoost =
      (profile.role === 'user' || profile.role === 'influencer') &&
      posts.length > 0 &&
      !boostRecentlyShown(profile.usernameUrl);
    boostShownRef.current = true;
    const timer = setTimeout(() => {
      if (hasBoost) {
        setBoostOpen(true);
        markBoostShown(profile.usernameUrl);
      } else if (referralPendingRef.current) {
        referralPendingRef.current = false;
        setReferralOpen(true);
      }
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallVariant, profile, posts.length, authUser]);

  /* Closing the boost modal reveals the pending referral modal (Laravel: boost → referral). */
  function closeBoost() {
    setBoostOpen(false);
    if (referralPendingRef.current) {
      referralPendingRef.current = false;
      setReferralOpen(true);
    }
  }

  function refetch() {
    Promise.all([fetchProfile(usernameUrl), fetchProfilePosts(usernameUrl)])
      .then(([p, ps]) => {
        setProfile(p);
        setPosts(ps);
      })
      .catch(() => undefined);
  }

  /* reconcile a subscription/verified payment when Stripe redirects back here */
  const paymentStatus = usePaymentReturn(refetch);
  useEffect(() => {
    if (paymentStatus) {
      setSwal({
        icon: paymentStatus.ok ? 'success' : 'error',
        title: tUi(paymentStatus.ok ? 'payment_success_title' : 'payment_title'),
        text: paymentStatus.message,
      });
    }
  }, [paymentStatus]);

  /* Head of the same dropdown, at the client's request: copies this profile's public
     address -- the bare /{username} vanity URL, which is what Laravel's fallback route
     serves and what a guest can open. */
  /* the ring only appears while a story is live, so this is asked per profile */
  useEffect(() => {
    if (!profile?.usernameUrl) return;
    let cancelled = false;
    fetchUserStories(profile.usernameUrl)
      .then((d) => {
        if (!cancelled) setHasStory(d.stories.length > 0);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [profile?.usernameUrl]);

  function copyProfileLink() {
    if (!profile) return;
    setReportOpen(false);
    const write = navigator.clipboard?.writeText(`${window.location.origin}/${profile.usernameUrl}`);
    if (!write) {
      setSwal({ icon: 'error', title: tReport('share.failed'), text: '' });
      return;
    }
    void write
      .then(() => setSwal({ icon: 'success', title: tReport('share.copied'), text: '' }))
      .catch(() => setSwal({ icon: 'error', title: tReport('share.failed'), text: '' }));
  }

  function submitUserReport(reason: string) {
    if (!profile) return;
    setReportOpen(false);
    api
      .post('/users/reports/user', { username: profile.usernameUrl, reason })
      .then(() =>
        setSwal({ icon: 'success', title: tReport('sent_title'), text: tReport('thank_you') }),
      )
      .catch(() =>
        setSwal({ icon: 'error', title: tReport('failed_title'), text: tReport('failed_message') }),
      );
  }

  function toggleBlock() {
    if (!profile) return;
    const action = profile.viewerHasBlocked ? 'unblock' : 'block';
    api
      .post(`/users/${profile.id}/${action}`)
      .then(() => fetchProfile(profile.usernameUrl).then(setProfile))
      .catch(() => undefined);
    setReportOpen(false);
  }

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    Promise.all([fetchProfile(usernameUrl), fetchProfilePosts(usernameUrl)])
      .then(([p, ps]) => {
        if (cancelled) return;
        setProfile(p);
        setPosts(ps);
        setState('ok');
        document.title = `Superfans | ${p.usernameUrl}`;
      })
      .catch((err: { response?: { status?: number; data?: { data?: { status?: string } } } }) => {
        if (cancelled) return;
        if (err.response?.status !== 403) {
          setState('notfound');
          return;
        }
        /* 403 is the account gate, and the body says which kind — a closed account reads
           differently from a suspended one, as the blade's own error view does. */
        setState(err.response.data?.data?.status === 'deleted' ? 'deleted' : 'suspended');
      });
    return () => {
      cancelled = true;
    };
  }, [usernameUrl]);

  useEffect(() => {
    if (!reportOpen) return;
    const close = () => setReportOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [reportOpen]);

  /* observer-driven playback for grid videos (blade parity) */
  useEffect(() => {
    observeNewVideos();
  }, [posts]);

  if (state === 'loading') return null;
  /* an unknown handle is Laravel's errors/404 — "la página o perfil de usuario
     que estabas buscando no ha sido encontrada" names this case exactly */
  if (state === 'notfound') return <NotFoundPage />;
  if (state === 'suspended' || state === 'deleted' || !profile) {
    /* The client asked for the logo over this message and for the message itself to say how
       long it lasts and where to turn — the page used to be one red line on an empty screen.
       Same per-locale wordmark the sign-in pages and the loader draw, so a reader who lands
       here still knows whose site they are on. */
    return (
      <div style={{ textAlign: 'center', padding: '14vh 20px', fontFamily: 'Roboto, sans-serif' }}>
        <img
          src={localeLogo(i18n.resolvedLanguage ?? 'en')}
          alt="Superfans World"
          style={{ width: 320, maxWidth: '80%', height: 'auto', marginBottom: 28 }}
        />
        <h1 style={{ color: '#da1212', maxWidth: 720, margin: '0 auto' }}>
          {tUi(state === 'deleted' ? 'account_closed_short' : 'account_suspended_short')}
        </h1>
        {/* the "contact support" line belongs to a suspension, which can be lifted — a closed
            account is the client's own one-line wording and nothing to appeal */}
        {state !== 'deleted' && (
          <p style={{ color: '#555', fontSize: 17, maxWidth: 560, margin: '14px auto 0' }}>
            {tUi('account_suspended_support')}
          </p>
        )}
      </div>
    );
  }

  // last posts shown on the wall (Laravel: limit 2, newest first)
  const lastPosts = posts.slice(0, 2);
  /* what gives a viewer a claim on a hidden post, the All Posts page's own rule: a creator is
     subscribed to, a fan is followed. */
  const viewerHasAccess =
    profile.role === 'influencer' ? profile.viewerSubscribed : profile.viewerFollowing;
  const isOwner = authUser?.usernameUrl === profile.usernameUrl;

  return (
    <div id="fh5co-page">
      <PageLoader />
      <NavToggle />
      <MobileFooterMenu onAddPost={() => setAddPostOpen(true)} />

      {swal && <SwalResult {...swal} onClose={() => setSwal(null)} />}

      <SubscriberListModal
        usernameUrl={profile.usernameUrl}
        open={subListOpen}
        onClose={() => setSubListOpen(false)}
      />

      {/* Boost Your Post modal — port of #boostlatest-postModal (user/index.blade.php). */}
      {boostOpen && posts[0] && createPortal(
        <div
          className="sf-modal-scrim"
          onClick={closeBoost}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 123112311231, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div
            className="sf-modal-pop"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(135deg, #8a2be2, #7326b5)',
              borderRadius: 18,
              color: '#fff',
              border: 'none',
              boxShadow: '0 0 35px rgba(138,43,226,0.6)',
              width: '100%',
              maxWidth: 500,
              position: 'relative',
            }}
          >
            {/* header */}
            <div style={{ padding: '12px 48px 28px', textAlign: 'center', position: 'relative' }}>
              <h3 style={{ fontSize: 22, fontWeight: 900, fontFamily: "'Consolas', monospace", margin: '32px 0 0', color: '#fff' }}>
                🚀 Boost Your Post
              </h3>
              <button
                onClick={closeBoost}
                className="boost-modal-close"
                aria-label={tUi('close')}
                style={{ position: 'absolute', right: 15, top: 10, padding: 4, lineHeight: 1, background: 'transparent', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', opacity: 0.8 }}
              >
                ✖
              </button>
            </div>
            {/* body */}
            <div style={{ padding: '8px 20px 20px', textAlign: 'center' }}>
              {posts[0].imageVideo &&
                (isVideoFile(posts[0].imageVideo) ? (
                  /* David, 30 Sep 2026: "Video Controls out of this modal in case of
                     video / Autoplay with NO VOLUME". The blade has `controls` here
                     (user/index.blade.php:2102) and no autoplay — this is his change,
                     not a porting slip, so it should not be "corrected" back.
                     `muted` is what makes the autoplay allowed at all: every browser
                     blocks a clip that starts with sound, and this modal opens on its
                     own rather than off a tap, so there is no gesture to rely on. It
                     is also the no-volume he asked for, so the one attribute covers
                     both. `loop` because a short clip that plays once and freezes on
                     its last frame reads as broken, and the reader has no controls
                     left to restart it with. */
                  <video
                    autoPlay
                    muted
                    loop
                    playsInline
                    /* React sets muted as a DOM property but does not always emit the
                       attribute; setting it on the node too means autoplay is never
                       refused over a missing attribute. */
                    ref={(el) => {
                      if (el) el.muted = true;
                    }}
                    poster={posts[0].thumbnail ? assetImage(`thumbnails/${posts[0].thumbnail}`) : undefined}
                    style={{ width: 200, borderRadius: 14, border: '4px solid rgba(255,255,255,0.4)', boxShadow: '0 0 20px rgba(255,255,255,0.25)', marginBottom: 15, maxWidth: '100%', height: 'auto' }}
                  >
                    <source src={assetImage(posts[0].imageVideo)} type={videoMime(posts[0].imageVideo)} />
                  </video>
                ) : (
                  <img
                    src={assetImage(posts[0].imageVideo)}
                    alt={tUi('alt_post_media')}
                    style={{ width: 200, borderRadius: 14, border: '4px solid rgba(255,255,255,0.4)', boxShadow: '0 0 20px rgba(255,255,255,0.25)', marginBottom: 15 }}
                  />
                ))}
              <p style={{ fontSize: 16, marginTop: 8, lineHeight: 1.4 }}>
                {tUi('post_gaining_attention')}
                <br />
                <b>{tUi('boost_now')}</b>
              </p>
              {/* David, 1 Oct 2026: "Open SW Ads in another tab". The blade's own link
                  (user/index.blade.php:2120) navigates in place; opening a tab keeps the
                  wall where it was, so closing Super Ads returns to the post rather than
                  to a reloaded feed. `noreferrer` comes with the new tab — without it the
                  opened page keeps a handle on this one through `window.opener`. */}
              <a
                href={`/super-ads/buy/${posts[0].id}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-success boost-modal-cta"
                style={{ display: 'inline-block', padding: '12px 22px', background: '#5cb85c', color: '#000', border: '3px solid #409c40', borderRadius: 0, fontSize: 17, fontWeight: 800, marginTop: 12, textDecoration: 'none' }}
              >
                ⚡ Buy Fast Ads
              </a>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Invite-a-friend modal — port of #referralModal (purple, shown once after login). */}
      {referralOpen && createPortal(
        <div
          className="sf-modal-scrim"
          onClick={() => setReferralOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 123112311231, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div
            className="sf-modal-pop"
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#8a2be2', color: '#fff', textAlign: 'center', borderRadius: 7, border: 'none', boxShadow: 'none', width: 600, maxWidth: 'calc(100% - 20px)', padding: 15 }}
          >
            <br />
            <h2 style={{ margin: 0 }}>🙋🏻‍♂️💰</h2>
            <h3 style={{ color: '#fff', fontSize: 24, fontWeight: 700 }}>{t('modal_invite_title')}</h3>
            <p style={{ color: '#fff', fontSize: 20, fontWeight: 300 }}>
              {t('modal_invite_text')} <strong>{referralUsername}</strong>
            </p>
            {/* .swal2-style buttons per the blade: white, black text, Copy has a 3px border. */}
            <button
              style={{ marginTop: 8, background: '#fff', color: '#000', border: '3px solid #000', borderRadius: 0, padding: '8px 20px', fontWeight: 700, fontSize: 15, textTransform: 'uppercase', transition: '0.3s', cursor: 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#000'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#000'; }}
              onClick={() => {
                void navigator.clipboard?.writeText(referralUsername);
                window.alert(tUi('username_copied'));
              }}
            >
              {t('modal_invite_button_copy')}
            </button>
            <button
              type="button"
              style={{ marginTop: 16, marginLeft: 8, background: '#fff', color: '#000', border: 'none', borderRadius: 0, padding: '8px 20px', fontWeight: 700, fontSize: 15, textTransform: 'uppercase', transition: '0.3s', cursor: 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#ec1919'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#000'; }}
              onClick={() => setReferralOpen(false)}
            >
              {t('modal_invite_button_close')}
            </button>
          </div>
        </div>,
        document.body,
      )}

      {/* header sits at page level, exactly like the blade's @include before @yield */}
      <GuestHeader usernameUrl={profile.usernameUrl} />

      <ProfileSidebar
        profile={profile}
        onAddPost={() => setAddPostOpen(true)}
        onControlPanel={() => setControlPanelOpen(true)}
      />

      {/* The modal depends on role and on which layout the page uses: creators get the
          influencer modal; fans get the fuller #userModalCenter on the wall/world pages
          (layouts.main) and the layouts_direct_user one on the canonical /{username}.

          On someone else's wall the sidebar still belongs to the viewer, so its Control
          Panel is the viewer's own — ControlPanelHost fetches that profile itself, the way
          Add Post below already does. Gating the whole thing on isOwner left the item dead
          on every profile but your own. */}
      {controlPanelOpen && !isOwner && <ControlPanelHost open onClose={() => setControlPanelOpen(false)} />}
      {controlPanelOpen &&
        isOwner &&
        (authUser?.role === 'influencer' ? (
          <InfluencerControlPanelModal
            profile={profile}
            onClose={() => setControlPanelOpen(false)}
            onSaved={refetch}
          />
        ) : wallVariant ? (
          <UserModalCenter
            profile={profile}
            onClose={() => setControlPanelOpen(false)}
            onSaved={refetch}
          />
        ) : (
          <ControlPanelModal
            profile={profile}
            onClose={() => setControlPanelOpen(false)}
            onSaved={refetch}
          />
        ))}

      <div id="fh5co-main">
        {/* cover */}
        <div style={{ textAlign: 'right', position: 'relative' }}>
          {profile.coverPicture ? (
            <img
              src={assetImage(profile.coverPicture)}
              style={{ maxHeight: '50%', width: '100%', height: '50%' }}
              alt=""
            />
          ) : profile.coverColor === 'purple' ? (
            <img
              src={assetImage('image1718137360.png')}
              style={{ maxHeight: 129, width: '100%', height: 129 }}
              alt=""
            />
          ) : (
            <img
              src={assetImage('coverYellow.png')}
              style={{ maxHeight: 129, width: '100%', height: 129 }}
              alt=""
            />
          )}
        </div>

        {/* "Mis publicaciones" inside this modal must always be the SIGNED-IN user's own
            posts. The blade re-queries them in the modal itself
            (layouts_direct_user/footer.blade.php: influencer_id = Auth::user()->id, limit 6),
            so it never shows the profile being visited. Handing it this page's `posts`
            did exactly that on someone else's wall. On your own wall they are the same
            list, and keeping it lets the grid refresh after you post. */}
        {addStoryOpen && (
          <AddStoryModal
            onClose={() => setAddStoryOpen(false)}
            onPosted={() => setHasStory(true)}
          />
        )}
        {storyOpen && profile.usernameUrl && (
          <StoryViewer usernameUrl={profile.usernameUrl} onClose={() => setStoryOpen(false)} />
        )}

        {addPostOpen &&
          (isOwner ? (
            <AddPostModal myPosts={posts} onClose={() => setAddPostOpen(false)} onChanged={refetch} />
          ) : (
            <AddPostHost open onClose={() => setAddPostOpen(false)} />
          ))}

        <div className="fh5co-narrow-content" style={{ paddingTop: 0, marginTop: -54 }}>
          <center>
            {/* avatar */}
            {/* Stories, Pas 1 and Pas 5: a live story rings the picture, and the + the
                mockup lifted off the cover sits at the picture's corner. Tapping the ring
                plays the story; tapping the + opens Add Storie. */}
            <span style={{ position: 'relative', display: 'inline-block', lineHeight: 0 }}>
              <span
                className={hasStory ? 'story-ring' : undefined}
                onClick={hasStory ? () => setStoryOpen(true) : undefined}
                style={hasStory ? { cursor: 'pointer' } : undefined}
              >
                {profile.profilePicture ? (
                  <img
                    src={assetImage(profile.profilePicture)}
                    /* PROFILE PICTURE BORDER: the control panel's Yes/No, not "has a picture".
                       The ring belongs to whoever's picture this is, so it reads that account's
                       own setting and shows on a visitor's view too.
                       Laravel only ever drew it on your own wall — user/index.blade.php:1541 and
                       influencer/activity.blade.php:1339 gate it on `Auth::user()->
                       profile_picture_border_status == '1'`, while the blades for someone else's
                       profile (influencer_activity.blade.php:1180, user_activity.blade.php:1291)
                       carry no border at all. David asked (28 Sep 2026) for it on a visited
                       profile as well, so this departs from the blade deliberately. It also
                       settles a split inside this page: the sidebar's own card has been ringing
                       the visited profile's picture all along (ProfileSidebar's FlipLogo), which
                       is the mismatch he photographed. */
                    style={{
                      width: 92,
                      height: 92,
                      borderRadius: 74,
                      ...(profile.profilePictureBorderStatus === '1'
                        ? { border: '4px solid white' }
                        : null),
                    }}
                    alt=""
                  />
                ) : (
                  <img
                    src="/assets/images/SUPERHEROINA.svg"
                    style={{ width: 92, height: 92, borderRadius: 74 }}
                    alt=""
                  />
                )}
              </span>
              {isOwner && (
                <i
                  className="fa fa-plus story-add-badge"
                  onClick={() => setAddStoryOpen(true)}
                  title={tUi('add_story')}
                  aria-hidden="true"
                ></i>
              )}
            </span>

            <br />
            <br />
            <b style={{ color: 'gray' }}>
              {profile.name}
              {profile.bio && <Bio bio={profile.bio} />}
            </b>

            {/* @username + verified + report dropdown */}
            <div style={{ display: 'block', position: 'relative' }}>
              {/* client change: nicknames read bold, as they already do in the world feed */}
              <span style={{ userSelect: 'text' }}>
                @{profile.usernameUrl}{' '}
                {profile.verified && (
                  <img
                    src={assetImage('verified.png')}
                    alt={tUi('alt_verified')}
                    width={18}
                    height={18}
                    style={{ position: 'relative', bottom: 1, display: 'inline-block' }}
                  />
                )}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setReportOpen((v) => !v);
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  /* client change: Laravel sets `padding: 0 4px` here and pulls the
                     arrow 2px left again, leaving a 2px gap that reads as glued to
                     the handle. The extra 6px on the left opens it to 8px. */
                  padding: '0 4px 0 10px',
                  fontSize: 'inherit',
                  display: 'inline-block',
                }}
              >
                <img
                  src={assetImage('arrowDown_.png')}
                  alt="▼"
                  style={{ width: 12, height: 12, position: 'relative', bottom: 1, right: 2, display: 'inline-block' }}
                />
              </button>

              {reportOpen && (
                <div
                  className="user-report-op"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    top: '120%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'white',
                    border: '1px solid #ccc',
                    borderRadius: 6,
                    zIndex: 100,
                    width: 320,
                  }}
                >
                  <ul
                    style={{
                      listStyle: 'none',
                      margin: 0,
                      padding: 0,
                      background: '#fff',
                      borderRadius: 8,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      overflow: 'hidden',
                      width: '100%',
                    }}
                  >
                    <li style={{ borderBottom: '1px solid #eee' }}>
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          copyProfileLink();
                        }}
                        style={{
                          display: 'block',
                          padding: '10px 15px',
                          textDecoration: 'none',
                          color: '#333',
                          fontSize: 13,
                          textAlign: 'center',
                        }}
                      >
                        📤 {tReport('share.profile')}
                      </a>
                    </li>
                    {REPORT_REASONS.map((reason) => {
                      const label = tReport(`reasons.${reason}`);
                      return (
                        <li key={reason} style={{ borderBottom: '1px solid #eee' }}>
                          <a
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              submitUserReport(label);
                            }}
                            style={{
                              display: 'block',
                              padding: '10px 15px',
                              textDecoration: 'none',
                              color: '#333',
                              fontSize: 13,
                              textAlign: 'center',
                            }}
                          >
                            {label}
                          </a>
                        </li>
                      );
                    })}
                    {authUser && authUser.id !== profile.id && (
                      <li style={{ borderBottom: '1px solid #eee' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleBlock();
                          }}
                          style={{
                            width: '100%',
                            padding: '10px 15px',
                            border: 'none',
                            background: 'none',
                            textAlign: 'center',
                            fontSize: 13,
                            cursor: 'pointer',
                            color: profile.viewerHasBlocked ? '#856404' : 'red',
                          }}
                        >
                          {profile.viewerHasBlocked ? tUi('unblock_user') : tUi('block_user')}
                        </button>
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>

            <br />

            {/* guest follow / subscribe buttons (register modal flow → /register) */}
            {!authUser && (
              <div className="col-12 d-flex justify-content-center align-items-center">
                {/* a creator who charges: the free Follow and the blue Subs, as a signed-in
                    visitor sees them (FollowButtons) — both lead to registering first */}
                {profile.role === 'influencer' && (profile.priceOfSubscription ?? 0) > 0 ? (
                  <div className="profile-cta-row">
                    {/* the free Follow only when the creator turned it on in their control panel */}
                    {profile.freeFollow && (
                      <span
                        className="btn btn-primary btn-outline profile-follow-btn play-sound1"
                        onClick={() => registerModal.open()}
                      >
                        <img
                          src="/assets/images/SUPERHEROINA.svg"
                          style={{ width: '17.47%', margin: 3, position: 'relative', left: -4, display: 'inline-block' }}
                          alt=""
                        />
                        {t('follow', { defaultValue: 'Follow' })} <b>+</b>
                      </span>
                    )}
                    <button
                      type="button"
                      className="btn btn-outline profile-subs-btn play-sound1"
                      onClick={() => registerModal.open()}
                    >
                      {/* alone on the row it says the whole word, beside Follow the short one */}
                      🔒 {profile.freeFollow
                        ? t('subs_btn', { defaultValue: 'Subs' })
                        : t('subscribe', { defaultValue: 'Subscribe' })} + | {formatPrice(profile.priceOfSubscription)}
                    </button>
                    <button
                      className="btn btn-success play-sound1"
                      onClick={() => registerModal.open()}
                      style={{
                        border: '2px solid #409c40',
                        width: 65,
                        height: 59,
                        display: 'inline-block',
                        marginLeft: 1,
                      }}
                    >
                      ✉️
                    </button>
                  </div>
                ) : (
                  <>
                    <span
                      className="btn btn-primary btn-outline play-sound1"
                      onClick={() => registerModal.open()}
                      style={{ width: 226 }}
                    >
                      <img
                        src="/assets/images/SUPERHEROINA.svg"
                        style={{ width: '17.47%', margin: 3, position: 'relative', left: -4, display: 'inline-block' }}
                        alt=""
                      />
                      {t('follow', { defaultValue: 'Follow' })} <b>+</b>
                    </span>
                    <button
                      className="btn btn-success play-sound1"
                      onClick={() => registerModal.open()}
                      style={{
                        border: '2px solid #409c40',
                        width: 65,
                        height: 59,
                        display: 'inline-block',
                        marginLeft: 1,
                      }}
                    >
                      ✉️
                    </button>
                    <br />
                  </>
                )}
              </div>
            )}

            {/* Logged-in button row (user_profile.blade.php L1676-1710). On your OWN
                profile the blade still shows the "Follow +" button, but it opens the
                control panel instead of following; other users get real follow/unfollow. */}
            {authUser && (
              <FollowButtons
                profile={profile}
                isOwner={isOwner}
                onChanged={refetch}
                onControlPanel={() => setControlPanelOpen(true)}
              />
            )}

            {/* Stats line. The blade writes malformed markup — `<b><a …>22</b> Post</a>` —
                which browsers fix up into `<b><a>22</a></b><a> Post</a>`, so the LABEL is
                inside the 0.69em link too (both number and word render at 13.8px).
                This mirrors that fixed-up structure, including the exact spacing. */}
            <b>
              <Link to={`/posts/${profile.usernameUrl}`} style={{ fontSize: '0.69em' }}>
                {profile.postsCount}
              </Link>
            </b>
            <Link to={`/posts/${profile.usernameUrl}`} style={{ fontSize: '0.69em' }}>
              {' '}
              {t('post', { defaultValue: 'Posts' })}
            </Link>
            {' | '}
            <b>
              <a style={{ fontSize: '0.69em' }}>
                <span className="number_of_likes">{formatNumber(profile.likesTotal)}</span>
              </a>
            </b>
            <a style={{ fontSize: '0.69em' }}>
              {' '}
              {t('likes', { defaultValue: 'Likes' })}{' '}
            </a>
            {' | '}
            <b>
              <a className="direct_subscriber_list" style={{ fontSize: '0.69em', cursor: 'pointer' }} onClick={() => setSubListOpen(true)}>
                {formatNumber(profile.followersTotal)}
              </a>
            </b>
            <a className="direct_subscriber_list" style={{ fontSize: '0.69em', cursor: 'pointer' }} onClick={() => setSubListOpen(true)}>
              {' '}
              {t('followers', { defaultValue: 'Followers' })}
            </a>
            <h2
              className="fh5co-heading animate-box"
              style={{ fontFamily: "'Roboto Slab', serif", color: '#dd2110' }}
            ></h2>
          </center>

          {/* blocked states (blade lines 2032-2060) replace the grid entirely */}
          {profile.viewerHasBlocked ? (
            <div
              style={{ padding: 15 }}
              className="alert-warning d-flex justify-content-between align-items-center"
            >
              <div>
                <strong>{tUi('you_blocked_user')}</strong>
                <br />
                {tUi('you_blocked_note')}
              </div>
              <center>
                <button type="button" className="btn btn-sm btn-secondary" onClick={toggleBlock}>
                  {tUi('unblock')}
                </button>
              </center>
            </div>
          ) : profile.viewerIsBlockedBy ? (
            <div style={{ padding: 15, width: '90%', margin: 'auto' }} className="alert-danger">
              <strong>{tUi('user_blocked_you')}</strong>
              <br />
              You can&apos;t access their profile or content.
            </div>
          ) : lastPosts.length > 0 ? (
            <div className="row animate-box" style={{ display: 'flex', flexWrap: 'wrap' }}>
              {lastPosts.map((post) => (
                <PostItem
                  key={post.id}
                  post={post}
                  /* The same test the All Posts page makes (Posts.tsx, from user_posts.blade):
                     the owner sees everything, and for anyone else a post is locked only when it
                     is hidden AND they have no claim on it — subscribed to a creator, following
                     a fan. This wall had neither half of that. It asked whether the profile
                     belonged to a creator and whether the post was hidden, and stopped there,
                     so a subscriber still met a padlock on a creator's wall while a hidden post
                     on a fan's wall was shown to everybody. */
                  locked={!isOwner && !post.visible && !viewerHasAccess}
                  author={{
                    usernameUrl: profile.usernameUrl,
                    profilePicture: profile.profilePicture,
                    verified: profile.verified,
                  }}
                />
              ))}

              {/* "All Posts" is its own work-item slot BETWEEN the posts and the
                  network tiles — same flex row, exactly like the blade */}
              <div
                className="col-md-4 col-sm-6 col-xs-6 col-xxs-12 work-item"
                style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
              >
                <center style={{ width: '100%', marginBottom: '0.29em' }}>
                  <Link to={`/posts/${profile.usernameUrl}`} className="btn btn-primary btn-outline">
                    {t('all_posts', { defaultValue: 'All Posts' })}
                  </Link>
                </center>
              </div>

              {profile.networkDetails.map((network) => (
                <div key={network.id} className="col-md-4 col-sm-6 col-xs-6 col-xxs-12 work-item">
                  <br />
                  <a href={network.link}>
                    <img
                      /* the grey card artwork from the client's BLUE 24 set */
                      src={networkLogo(network.name, 'card') ?? assetImage(network.feedImage)}
                      alt=""
                      className="img-responsive"
                      style={{ borderRadius: 26, border: '7px solid lightgray', width: '100%' }}
                    />
                  </a>
                  <center>
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                    <b>
                      <a href={network.link} style={{ fontSize: '0.92em' }}>
                        <span style={{ color: '#da1212' }}>
                          <b>
                            <span>
                              <img
                                src={assetImage(network.id === 1 ? 'twitch_article.png' : network.image)}
                                className={`network_icon${[73, 72, 81, 71, 41].includes(network.id) ? ' small_network_icon' : ''}`}
                                style={{
                                  width: [73, 72, 81, 71, 41].includes(network.id) ? 38 : 34,
                                  display: 'inline-block',
                                  position: 'absolute',
                                  border: '7px solid transparent',
                                  marginTop: [3, 73, 81, 41, 4].includes(network.id) ? 3 : undefined,
                                }}
                                alt=""
                              />
                            </span>
                            <b style={{ marginLeft: 34 }}>
                              {' '}
                              <span style={{ fontWeight: 'normal' }}>
                                {t('go_to', { defaultValue: 'Go to' })}
                              </span>{' '}
                              {network.name}
                            </b>
                          </b>
                        </span>
                      </a>
                    </b>
                  </center>
                </div>
              ))}
            </div>
          ) : (
            <div className="col-12" style={{ width: '100%' }}>
              <p style={{ textAlign: 'center', color: 'rgba(0, 0, 0, 0.5)' }}>
                <img
                  src={assetImage('time_icon.PNG')}
                  style={{ marginTop: -7, height: 32, width: 25, display: 'inline-block' }}
                  alt=""
                />{' '}
                No hay posts todabía &nbsp;&nbsp;
              </p>
            </div>
          )}

        </div>

        <EarnSection />
        <ProfilePageFooter profile={profile} />
      </div>
    </div>
  );
}

/**
 * Logged-in button row (user_profile.blade.php L1676-1710): a "Follow +" / "Followed |✓"
 * button + the green chat button.
 *
 * On your own profile (`isOwner`) the blade still renders the "Follow +" button, but it
 * opens the control panel rather than following, and the "Followed" state never applies.
 * Following is free; paid subscription (the "| $price" CTA) is the Redsys milestone.
 */
export function FollowButtons({
  profile,
  isOwner = false,
  onChanged,
  onControlPanel,
}: {
  profile: ProfileData;
  isOwner?: boolean;
  onChanged: () => void;
  onControlPanel?: () => void;
}) {
  const { t } = useTranslation('content');
  const { t: tUi } = useTranslation('ui');
  /* who is looking — the chat dialog writes as them and draws their picture beside their
     own lines */
  const { user: viewer } = useAuth();
  const [following, setFollowing] = useState(profile.viewerFollowing);
  const [subscribed, setSubscribed] = useState(profile.viewerSubscribed);
  const [busy, setBusy] = useState(false);
  const [subModalOpen, setSubModalOpen] = useState(false);
  /* the one dialog left behind the ✉️: the $10 that buys the right to write */
  const [premiumOpen, setPremiumOpen] = useState(false);
  /* `?chat=1` comes back on the premium checkout's return: the fan has just bought the right
     to write, so the dialog opens on arrival rather than making them find the ✉️ again. Read
     once, at the first render, and the flag is taken out of the address with the payment's
     own params so a reload does not raise it a second time. */
  const [chatOpen, setChatOpen] = useState(
    () => new URLSearchParams(window.location.search).get('chat') === '1',
  );

  /* keep the button in sync when the parent refetches the profile (e.g. after a
     payment reconciles the subscription). */
  useEffect(() => setFollowing(profile.viewerFollowing), [profile.viewerFollowing]);
  useEffect(() => setSubscribed(profile.viewerSubscribed), [profile.viewerSubscribed]);

  /* An influencer profile with a price is a paid subscription (Stripe checkout); a normal
     user profile is a free follow. */
  const isPaidCreator = profile.role === 'influencer' && (profile.priceOfSubscription ?? 0) > 0;

  function toggleFollow() {
    if (busy) return;
    setBusy(true);
    const req = following
      ? api.delete(`/me/follow/${profile.id}`)
      : api.post(`/me/follow/${profile.id}`);
    req
      .then(() => {
        setFollowing((v) => !v);
        onChanged();
      })
      .finally(() => setBusy(false));
  }

  function subscribe() {
    if (busy) return;
    setBusy(true);
    api
      .post<{ url?: string }>(`/payments/subscribe/${profile.id}`)
      .then(({ data }) => {
        if (data.url) window.location.href = data.url;
        else setBusy(false);
      })
      .catch(() => setBusy(false));
  }

  function unsubscribe() {
    if (busy) return;
    setBusy(true);
    api
      .delete(`/payments/subscription/${profile.id}`)
      .then(() => {
        setSubscribed(false);
        onChanged();
      })
      .finally(() => setBusy(false));
  }

  const superheroina = (
    <img
      src="/assets/images/SUPERHEROINA.svg"
      style={{ width: '17.47%', margin: 3, position: 'relative', left: -4, display: 'inline-block' }}
      alt=""
    />
  );

  /* The blade's ✉️ button, branch for branch (user_profile.blade.php:1172-1215):
       own page                       → the inbox
       not subscribed                 → #paymentModalCenter, the subscribe modal
       blocked either way             → no button at all
       chat_toggle on, or already paid → #uchatmodal, the write-to-them dialog
       otherwise (the creator is busy) → the premium-fan pair, ending at $10
     Only the first of those was wired here, so on anybody else's profile the button did
     nothing. Where the blade opens a dialog to write in, this sends the fan to the
     Messages page with the creator's conversation open — the client's own call, and the
     same /chatbox thread either way. */
  const blocked = profile.viewerHasBlocked || profile.viewerIsBlockedBy;
  const canWrite = profile.chatToggle || !!profile.viewerPremium;

  function onChatClick() {
    if (isOwner) {
      window.location.href = '/user/messages';
      return;
    }
    if (!subscribed) {
      setSubModalOpen(true);
      return;
    }
    /* The blade's own dialog, back where it was. It was the Messages page for a while — the
       same /chatbox conversation either way, and landing in the real inbox was the client's
       call at the time — but he has asked for the blade's "Chat with @name" again, so that is
       what opens. Nothing is lost by it: a message written here is the same thread the inbox
       shows. */
    if (canWrite) setChatOpen(true);
    else setPremiumOpen(true);
  }

  const chatBtn = blocked ? null : (
    <button
      id="chat_with_me_btn"
      type="button"
      className="btn btn-success"
      onClick={onChatClick}
      style={{ border: '2px solid #409c40', width: 65, height: 59, display: 'inline-block', marginLeft: 1 }}
    >
      {' '}
      ✉️{' '}
    </button>
  );

  /* David, 6 Oct 2026: "Now INFLUENCERS CREATORS can be followed for free (but when they are
     followed, the Hidden Posts still blocked) — the posts only are visible if they pay
     Subscription. So: New Blue Button for subscription." A creator who charges therefore
     carries two buttons where they had one: the free "Follow +" every account has, and the
     blue "🔒 Subs + | $price" beside it. Following gives the feed and the profile, never the
     hidden posts — the server opens those to subscribers only (posts.routes.ts), which is
     unchanged. A creator with no price, and every normal user, keep the one Follow button.
     The pair is laid out by .profile-cta-row (profile-page.css): centred labels, sizes off
     his mockup on a desktop, and lettering that steps down on a narrow phone so the three
     buttons keep to one line. The single Follow button keeps its 226px.
     Since 15 Oct 2026 the free Follow is the creator's own choice (showFollow, below). */
  const followClass = `btn btn-primary btn-outline${isPaidCreator ? ' profile-follow-btn' : ''}`;
  const followStyle = isPaidCreator ? undefined : { width: 226 };
  const followBtn = isOwner ? (
    /* on your own profile both buttons open the control panel, where the price is set — the
       creator sees the row the way their fans see it */
    <button
      type="button"
      className={followClass}
      onClick={onControlPanel}
      style={followStyle}
    >
      {superheroina}
      {t('follow', { defaultValue: 'Follow' })} <b>+</b>
    </button>
  ) : following ? (
    <span
      className={followClass}
      onClick={toggleFollow}
      style={{ ...followStyle, cursor: 'pointer' }}
    >
      {superheroina}
      {t('followed', { defaultValue: 'Followed' })}{' '}
      | <b><i className="fa fa-check" style={{ fontSize: 17 }} aria-hidden="true"></i></b>
    </span>
  ) : (
    <button
      type="button"
      className={followClass}
      onClick={toggleFollow}
      style={followStyle}
    >
      {superheroina}
      {t('follow', { defaultValue: 'Follow' })} <b>+</b>
    </button>
  );

  /* A creator who charges chooses in their control panel whether the free Follow stands
     beside Subscribe (David, 15 Oct 2026); Subscribe alone is the default. Someone who
     already follows them keeps the button, so they can still unfollow. */
  const showFollow = !isPaidCreator || !!profile.freeFollow || (following && !isOwner);

  /* the blue subscription button — the only way to the hidden posts. Beside Follow it is the
     short "Subs"; alone it has the whole row, so the full word (David, 16 Oct 2026: "Put full
     word SUBSCRIBE when it's only 1 button") */
  const subsLabel = showFollow
    ? t('subs_btn', { defaultValue: 'Subs' })
    : t('subscribe', { defaultValue: 'Subscribe' });
  const subsBtn = !isPaidCreator ? null : (
    <button
      type="button"
      className="btn btn-outline profile-subs-btn"
      onClick={isOwner ? onControlPanel : subscribed ? unsubscribe : () => setSubModalOpen(true)}
    >
      {subscribed && !isOwner ? (
        <>
          {tUi('subscribed')} | <i className="fa fa-check" aria-hidden="true"></i>
        </>
      ) : (
        <>
          🔒 {subsLabel} + | {formatPrice(profile.priceOfSubscription)}
        </>
      )}
    </button>
  );

  return (
    <div
      className={isPaidCreator ? 'profile-cta-row' : undefined}
      style={isPaidCreator ? undefined : { display: 'flex', justifyContent: 'center', gap: 1 }}
    >
      {showFollow && followBtn}
      {subsBtn}
      {chatBtn}

      <SubscribeModal
        usernameUrl={profile.usernameUrl}
        open={subModalOpen}
        busy={busy}
        onClose={() => setSubModalOpen(false)}
        onConfirm={subscribe}
      />

      {premiumOpen && (
        <PremiumFanModal
          influencerId={profile.id}
          usernameUrl={profile.usernameUrl}
          profilePicture={profile.profilePicture}
          onClose={() => setPremiumOpen(false)}
        />
      )}

      {chatOpen && viewer && (
        <ChatWithModal
          influencerId={profile.id}
          usernameUrl={profile.usernameUrl}
          profilePicture={profile.profilePicture}
          viewerId={viewer.id}
          viewerPicture={viewer.profilePicture}
          onClose={() => setChatOpen(false)}
        />
      )}
    </div>
  );
}

/** "Start earning with your Social Network" 3-column section (shared by wall + posts pages). */
export function EarnSection() {
  const { t: tFooter } = useTranslation('footer');
  return (
    <>
      <hr style={{ marginBottom: 0 }} />
      <div className="fh5co-narrow-content">
        <div className="row">
          <div className="col-md-4 animate-box">
            <h1 className="fh5co-heading-colored">
              {tFooter('start_earning_header_2', { defaultValue: 'Start earning with your Social Network' })}
            </h1>
          </div>
        </div>
        <div className="row">
          <div className="col-md-4 animate-box">
            <p className="fh5co-lead" style={{ fontWeight: 300 }}>
              {tFooter('lead_paragraph_1', { defaultValue: '' })}
            </p>
            <p>
              <a href="/creador" target="_blank" className="btn btn-primary btn-outline">
                <img
                  src="/assets/images/SUPERHEROINA.svg"
                  style={{ width: '14.47%', position: 'relative', left: -11, display: 'inline-block' }}
                  alt=""
                />
                <span style={{ position: 'relative', left: -6 }}>
                  {tFooter('start_now_button', { defaultValue: 'Start Now' })}
                </span>
              </a>
            </p>
          </div>
          <div className="col-md-7 col-md-push-1">
            <div className="row">
              <div className="col-md-6 animate-box">
                <p style={{ fontWeight: 300 }}>{tFooter('lead_paragraph_2', { defaultValue: '' })}</p>
              </div>
              <div className="col-md-6 animate-box">
                <p
                  style={{ fontWeight: 300 }}
                  dangerouslySetInnerHTML={{ __html: tFooter('lead_paragraph_3', { defaultValue: '' }) }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/** Page footer: locale logo + SUPER ADS CENTER + copyright (shared by wall + posts pages). */
export function ProfilePageFooter({ profile }: { profile: ProfileData }) {
  const { i18n } = useTranslation();
  const { t: tFooter } = useTranslation('footer');
  return (
    <>
      <hr style={{ marginBottom: 0 }} />
      <div className="fh5co-narrow-content">
        <center>
          <img src={localeLogo(i18n.resolvedLanguage ?? 'en')} style={{ width: '11.1em' }} alt="" />
          <br />
          <br />
          <p>
            <b>
              <a href="/super-ads" target="_blank" style={{ color: 'gray', fontWeight: 550 }}>
                🏢: SUPER ADS CENTER
              </a>
            </b>
            <br />© 2021-2025{' '}
            {profile.footerNameUsername === 'username' ? (
              <>
                <span style={{ display: 'inline-block' }}>@</span>
                {profile.usernameUrl}
              </>
            ) : (
              <>
                {profile.name} {profile.surname ?? ''}
              </>
            )}{' '}
            <br />
            {tFooter('all_rights_reserved', { defaultValue: 'All Rights Reserved.' })} <br />
            {tFooter('powered_by', { defaultValue: 'Powered by' })}{' '}
            <a href="/world">SUPERFANSS.APP</a>
          </p>
        </center>
      </div>
    </>
  );
}
