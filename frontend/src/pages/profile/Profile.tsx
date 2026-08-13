import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { fetchProfile, fetchProfilePosts, type ProfileData, type ProfilePost } from '../../api/profiles';
import { assetImage, formatNumber, formatNumberRounded, isVideoFile, videoMime } from '../../utils/format';
import { observeNewVideos } from '../../utils/video';
import { useAuth } from '../../context/AuthContext';
import { usePaymentReturn } from '../../utils/usePaymentReturn';
import { GuestHeader, ProfileSidebar } from './ProfileSidebar';
import { AddPostModal } from './AddPostModal';
import { ControlPanelModal } from './ControlPanelModal';
import { UserModalCenter } from './UserModalCenter';
import { InfluencerControlPanelModal } from './InfluencerControlPanelModal';
import { VolumeButton } from '../../components/VolumeButton';
import { PostReportButton } from '../../components/PostReportButton';
import { useRegisterModal } from '../../components/RegisterModal';
import { PageLoader } from '../../components/PageLoader';
import { NavToggle } from '../../components/NavToggle';
import { MobileFooterMenu } from '../../components/MobileFooterMenu';
import { localeLogo } from '../auth/AuthShell';
import '../../styles/profile-page.css';
import { useLayoutPageStyles } from '../../components/StandalonePage';
import { SubscriberListModal } from './SubscriberListModal';
import { SubscribeModal } from './SubscribeModal';

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
const REPORT_REASONS = ['sensuality', 'impersonation', 'violence', 'racism', 'other'] as const;

/** sweetalert2-default-style result popup (white, icon, OK button). */
export function SwalResult({
  icon,
  title,
  text,
  onClose,
}: {
  icon?: 'success' | 'error';
  title: string;
  text?: string;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          /* Laravel's global .swal2-modal theme: purple background, white text, 1.2rem. */
          background: '#8a2be2',
          color: '#fff',
          borderRadius: 5,
          width: '32em',
          maxWidth: '90%',
          padding: '2em 1.6em',
          textAlign: 'center',
          /* SweetAlert2 fonts as rendered on the Laravel layout: Roboto body, ~12px base. */
          fontFamily: 'Roboto, Arial, sans-serif',
          fontSize: '12px',
        }}
      >
        {icon && (
          <div
            style={{
              width: 80,
              height: 80,
              margin: '0 auto 1em',
              borderRadius: '50%',
              border: `4px solid ${icon === 'success' ? '#a5dc86' : '#f27474'}`,
              color: icon === 'success' ? '#a5dc86' : '#f27474',
              fontSize: 46,
              lineHeight: '72px',
            }}
          >
            {icon === 'success' ? '✓' : '✕'}
          </div>
        )}
        <h2 style={{ fontFamily: 'Montserrat, Arial, sans-serif', fontSize: '22.5px', fontWeight: 600, margin: '0 0 0.4em', color: '#fff' }}>{title}</h2>
        {text && <div style={{ fontSize: '13.5px', fontWeight: 400, color: '#fff', marginBottom: '1.2em' }}>{text}</div>}
        <button
          type="button"
          onClick={onClose}
          style={{
            /* .swal2-confirm: white button, black text, no radius. */
            /* .swal2-confirm as rendered: 3px radius, Roboto 12px/700, ~7.5px 13.2px pad. */
            background: '#fff',
            color: '#000',
            border: 0,
            borderRadius: '3px',
            fontSize: '12px',
            fontWeight: 700,
            padding: '7.5px 13.2px',
            cursor: 'pointer',
          }}
        >
          OK
        </button>
      </div>
    </div>
  );
}

export function PostItem({
  post,
  locked,
  showReport = false,
}: {
  post: ProfilePost;
  locked: boolean;
  /* Laravel shows the per-post report control on the POSTS grid and the feed, but not on
     the profile WALL/activity view — so it is opt-in. */
  showReport?: boolean;
}) {
  const media = post.imageVideo;
  const navigate = useNavigate();
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* pair each tag with its avatar by position, keeping only the complete ones */
  const taggedPairs = (post.tags ?? [])
    .map((name, i) => [name.trim(), (post.taggedProfilePictures?.[i] ?? '').trim()] as const)
    .filter(([name, picture]) => name && picture);
  const [heart, setHeart] = useState(false);
  const [likes, setLikes] = useState(post.noOfLikes);
  const frame: React.CSSProperties = {
    borderRadius: 26,
    border: '7px solid lightgray',
    width: '100%',
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
      api
        .post<{ success: boolean; data: { likesTotal: number } }>(`/posts/${post.id}/like-toggle`)
        .then((r) => setLikes(r.data.data.likesTotal))
        .catch(() => undefined);
    } else {
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null;
        navigate(`/user/post_detail/${post.id}`);
      }, 350);
    }
  }

  return (
    <div className="col-md-4 col-sm-6 col-xs-6 col-xxs-12 work-item image-hover-wrapper" onClick={onMediaClick} style={{ position: 'relative', cursor: 'pointer' }}>
      <div className={`animated-heart${heart ? ' show' : ''}`} id={`heart-${post.id}`}></div>
      {/* Tagged handles ride above the media on the wall too, not just in the
          feeds — user/index.blade.php:1675. The blade drops a <br> instead when
          a post has none, and only prints a tag that has an avatar with it. */}
      {taggedPairs.length > 0 ? (
        <p
          className="feed_posts_heading_p"
          style={{ overflow: 'hidden', position: 'relative', width: '70%', height: 55, top: 25, fontSize: 14 }}
        >
          <span
            className="marquee-text"
            style={{ display: 'inline-block', whiteSpace: 'nowrap', animation: 'scroll-left 10s linear infinite' }}
          >
            {taggedPairs.map(([name, picture]) => (
              <Link
                key={name}
                to={`/${name}`}
                onClick={(e) => e.stopPropagation()}
                style={{ color: 'black', display: 'inline-flex', alignItems: 'center', marginRight: 10 }}
              >
                <img
                  className="feed_posts_heading_img"
                  src={assetImage(picture)}
                  alt=""
                  style={{ marginRight: 10, marginBottom: 0 }}
                />
                <span>@{name}</span>
              </Link>
            ))}
          </span>
        </p>
      ) : (
        <br />
      )}
      {locked || !media ? (
        <img src={assetImage('blue24.png')} alt="Nueva Modelo Superfans - ¡Bienvenid@ a mi Portfolio!" className="img-responsive" style={frame} />
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
        <img src={assetImage(media)} alt="Nueva Modelo Superfans - ¡Bienvenid@ a mi Portfolio!" className="img-responsive" style={frame} />
      )}
      <center>
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        <b>
          <a className="post_stats" style={{ fontSize: '0.69em' }}>
            <span className="eye-icon">👁️</span>{' '}
            <span className="number_of_post_likes">{formatNumberRounded(likes)}</span>
          </a>
          &nbsp;
        </b>
      </center>
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
  const { usernameUrl: routeUsername } = useParams();
  const { t } = useTranslation('content');
  const { user: authUser } = useAuth();
  const usernameUrl = routeUsername ?? authUser?.usernameUrl ?? '';
  const registerModal = useRegisterModal();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [state, setState] = useState<'loading' | 'ok' | 'notfound' | 'suspended'>('loading');
  const [reportOpen, setReportOpen] = useState(false);
  const [addPostOpen, setAddPostOpen] = useState(false);
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
    const hasBoost = profile.role === 'user' && posts.length > 0;
    boostShownRef.current = true;
    const timer = setTimeout(() => {
      if (hasBoost) setBoostOpen(true);
      else if (referralPendingRef.current) {
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
        icon: paymentStatus.includes('successful') ? 'success' : 'error',
        title: paymentStatus.includes('successful') ? 'Success' : 'Payment',
        text: paymentStatus,
      });
    }
  }, [paymentStatus]);

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
      .catch((err: { response?: { status?: number } }) => {
        if (cancelled) return;
        setState(err.response?.status === 403 ? 'suspended' : 'notfound');
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
  if (state === 'notfound') {
    return (
      <div style={{ textAlign: 'center', padding: '20vh 20px', fontFamily: 'Roboto, sans-serif' }}>
        <h1 style={{ fontSize: '4em', color: '#da1212' }}>404</h1>
        <p>Not Found</p>
      </div>
    );
  }
  if (state === 'suspended' || !profile) {
    return (
      <div style={{ textAlign: 'center', padding: '20vh 20px', fontFamily: 'Roboto, sans-serif' }}>
        <h1 style={{ color: '#da1212' }}>This account is suspended</h1>
      </div>
    );
  }

  // last posts shown on the wall (Laravel: limit 2, newest first)
  const lastPosts = posts.slice(0, 2);
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
          onClick={closeBoost}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 123112311231, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div
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
            <div style={{ padding: '15px 20px', textAlign: 'center', position: 'relative' }}>
              <h3 style={{ fontSize: 22, fontWeight: 900, fontFamily: "'Consolas', monospace", margin: 0, marginTop: 20, color: '#fff' }}>
                🚀 Boost Your Post
              </h3>
              <button
                onClick={closeBoost}
                style={{ position: 'absolute', right: 15, top: 10, marginTop: 10, background: 'transparent', border: 'none', color: '#fff', fontSize: 25, cursor: 'pointer', opacity: 0.8 }}
              >
                ✖
              </button>
            </div>
            {/* body */}
            <div style={{ padding: 20, textAlign: 'center' }}>
              {posts[0].imageVideo &&
                (isVideoFile(posts[0].imageVideo) ? (
                  <video
                    controls
                    playsInline
                    poster={posts[0].thumbnail ? assetImage(`thumbnails/${posts[0].thumbnail}`) : undefined}
                    style={{ width: 200, borderRadius: 14, border: '4px solid rgba(255,255,255,0.4)', boxShadow: '0 0 20px rgba(255,255,255,0.25)', marginBottom: 15, maxWidth: '100%', height: 'auto' }}
                  >
                    <source src={assetImage(posts[0].imageVideo)} type={videoMime(posts[0].imageVideo)} />
                  </video>
                ) : (
                  <img
                    src={assetImage(posts[0].imageVideo)}
                    alt="Post Media"
                    style={{ width: 200, borderRadius: 14, border: '4px solid rgba(255,255,255,0.4)', boxShadow: '0 0 20px rgba(255,255,255,0.25)', marginBottom: 15 }}
                  />
                ))}
              <p style={{ fontSize: 16, marginTop: 8, lineHeight: 1.4 }}>
                Your post is gaining attention!
                <br />
                <b>Boost it now and reach more people instantly!</b>
              </p>
              <a
                href={`/super-ads/buy/${posts[0].id}`}
                style={{ display: 'inline-block', padding: '12px 22px', background: '#00e676', color: '#000', fontSize: 17, fontWeight: 800, marginTop: 12, textDecoration: 'none' }}
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
          onClick={() => setReferralOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 123112311231, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div
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
                window.alert('Username copied!');
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
          (layouts.main) and the layouts_direct_user one on the canonical /{username}. */}
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
          {isOwner && (
            <i
              className="fa fa-plus add_post_icon"
              onClick={() => setAddPostOpen(true)}
              style={{
                background: 'white',
                borderRadius: 56,
                position: 'absolute',
                right: 20,
                bottom: 0,
                marginBottom: -12,
                cursor: 'pointer',
                zIndex: 2,
                boxShadow: '2px 2px 3px #e78267',
                color: '#8a2be2',
                fontSize: 12,
                padding: '5.5px 6.7px',
              }}
              aria-hidden="true"
            ></i>
          )}
        </div>

        {addPostOpen && (
          <AddPostModal myPosts={posts} onClose={() => setAddPostOpen(false)} onChanged={refetch} />
        )}

        <div className="fh5co-narrow-content" style={{ paddingTop: 0, marginTop: -54 }}>
          <center>
            {/* avatar */}
            {profile.profilePicture ? (
              <img
                src={assetImage(profile.profilePicture)}
                style={{ width: 92, height: 92, borderRadius: 74, border: '4px solid white' }}
                alt=""
              />
            ) : (
              <img
                src="/assets/images/SUPERHEROINA.svg"
                style={{ width: 92, height: 92, borderRadius: 74 }}
                alt=""
              />
            )}

            <br />
            <br />
            <b style={{ color: 'gray' }}>
              {profile.name}
              {profile.bio && <Bio bio={profile.bio} />}
            </b>

            {/* @username + verified + report dropdown */}
            <div style={{ display: 'block', position: 'relative' }}>
              {/* client change: nicknames read bold, as they already do in the world feed */}
              <span style={{ userSelect: 'text', fontWeight: 700 }}>
                @{profile.usernameUrl}{' '}
                {profile.verified && (
                  <img
                    src={assetImage('verified.png')}
                    alt="Verified"
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
                  padding: '0 4px',
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
                          {profile.viewerHasBlocked ? 'Unblock User' : 'Block User'}
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
                {profile.role === 'influencer' ? (
                  <>
                    <span
                      className="btn btn-primary btn-outline play-sound1"
                      onClick={() => registerModal.open()}
                      style={{ width: 226, display: 'inline-block' }}
                    >
                      <img
                        src="/assets/images/SUPERHEROINA.svg"
                        style={{ width: '17.47%', margin: 3, position: 'relative', left: -4, display: 'inline-block' }}
                        alt=""
                      />
                      {t('follow', { defaultValue: 'Follow' })} <b>+</b> | <b>${profile.priceOfSubscription ?? ''}</b>
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
                  </>
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
                <strong>You have blocked this user.</strong>
                <br />
                They cannot view your profile or interact with you until you unblock them.
              </div>
              <center>
                <button type="button" className="btn btn-sm btn-secondary" onClick={toggleBlock}>
                  Unblock
                </button>
              </center>
            </div>
          ) : profile.viewerIsBlockedBy ? (
            <div style={{ padding: 15, width: '90%', margin: 'auto' }} className="alert-danger">
              <strong>This user has blocked you.</strong>
              <br />
              You can&apos;t access their profile or content.
            </div>
          ) : lastPosts.length > 0 ? (
            <div className="row animate-box" style={{ display: 'flex', flexWrap: 'wrap' }}>
              {lastPosts.map((post) => (
                <PostItem
                  key={post.id}
                  post={post}
                  locked={profile.role === 'influencer' && !isOwner && !post.visible}
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
                      src={assetImage(network.feedImage)}
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
  const [following, setFollowing] = useState(profile.viewerFollowing);
  const [subscribed, setSubscribed] = useState(profile.viewerSubscribed);
  const [busy, setBusy] = useState(false);
  const [subModalOpen, setSubModalOpen] = useState(false);

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

  /* owner: goes to messages; other users: opens the chat modal (built in the chat milestone) */
  const chatBtn = (
    <button
      id="chat_with_me_btn"
      type="button"
      className="btn btn-success"
      onClick={() => {
        if (isOwner) window.location.href = '/user/messages';
      }}
      style={{ border: '2px solid #409c40', width: 65, height: 59, display: 'inline-block', marginLeft: 1 }}
    >
      {' '}
      ✉️{' '}
    </button>
  );

  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
      {isOwner ? (
        <button
          type="button"
          className="btn btn-primary btn-outline"
          onClick={onControlPanel}
          style={{ width: 226 }}
        >
          {superheroina}
          {t('follow', { defaultValue: 'Follow' })} <b>+</b>
        </button>
      ) : isPaidCreator ? (
        subscribed ? (
          <span
            className="btn btn-primary btn-outline"
            onClick={unsubscribe}
            style={{ width: 226, cursor: 'pointer' }}
          >
            {superheroina}
            {t('subscribed', { defaultValue: 'Subscribed' })}{' '}
            | <b><i className="fa fa-check" style={{ fontSize: 17 }} aria-hidden="true"></i></b>
          </span>
        ) : (
          <button type="button" className="btn btn-primary btn-outline" onClick={() => setSubModalOpen(true)} style={{ width: 226 }}>
            {superheroina}
            {t('follow', { defaultValue: 'Follow' })} <b>+</b> | <b>${profile.priceOfSubscription}</b>
          </button>
        )
      ) : following ? (
        <span
          className="btn btn-primary btn-outline"
          onClick={toggleFollow}
          style={{ width: 226, cursor: 'pointer' }}
        >
          {superheroina}
          {t('followed', { defaultValue: 'Followed' })}{' '}
          | <b><i className="fa fa-check" style={{ fontSize: 17 }} aria-hidden="true"></i></b>
        </span>
      ) : (
        <button
          type="button"
          className="btn btn-primary btn-outline"
          onClick={toggleFollow}
          style={{ width: 226 }}
        >
          {superheroina}
          {t('follow', { defaultValue: 'Follow' })} <b>+</b>
        </button>
      )}
      {chatBtn}

      <SubscribeModal
        usernameUrl={profile.usernameUrl}
        open={subModalOpen}
        busy={busy}
        onClose={() => setSubModalOpen(false)}
        onConfirm={subscribe}
      />
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
