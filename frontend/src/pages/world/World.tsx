import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { useScrollMemory, rememberScroll } from '../../utils/useScrollMemory';
import { markFeedReturn, recallFeed, rememberFeed } from '../../utils/feedMemory';
import { useTranslation } from 'react-i18next';
import { PresenceDot } from '../../components/PresenceDot';
import { AdCard } from '../../components/AdCard';
import { api } from '../../api/client';
import { assetImage, formatNumberRounded, isVideoFile, likePercent, videoMime } from '../../utils/format';
import { observeNewVideos } from '../../utils/video';
import { useAuth } from '../../context/AuthContext';
import { FooterLanguageSelector, GuestHeader, InfluencerSearch, LoggedInNav } from '../profile/ProfileSidebar';
import { VolumeButton } from '../../components/VolumeButton';
import { useRegisterModal } from '../../components/RegisterModal';
import { PostHeading } from '../../components/PostHeading';
import { RatingPill } from '../../components/RatingPill';
import { useRatingFeedback } from '../../utils/useRatingFeedback';
import { NetworkSlider } from '../../components/NetworkSlider';
import { networkLogo } from '../../utils/networkLogo';
import { PageLoader } from '../../components/PageLoader';
import { NavToggle } from '../../components/NavToggle';
import { MobileFooterMenu } from '../../components/MobileFooterMenu';
import { SwalResult } from '../profile/Profile';
import '../../styles/profile-page.css';
import '../../styles/world-page.css';
import { toSteps, WORLD_SEED, type WorldStep } from '../../utils/worldSequence';
import '../../styles/report-menu.css';
import '../../styles/logo-spin.css';
import { useLayoutPageStyles } from '../../components/StandalonePage';
import { ControlPanelHost } from '../profile/ControlPanelHost';
import { AddPostHost } from '../profile/AddPostHost';
import { StreamModal } from '../../components/StreamModal';
import { FlipLogo } from '../../components/FlipLogo';
/* The hardcoded network slider of world.blade.php (11 items, per-item icon styles) */
const WORLD_NETWORKS: { name: string; href: string; img: string }[] = [
  { name: 'TikTok', href: 'https://www.tiktok.com/', img: 'b05db292060a4b42799ad7abaf5d6130.png' },
  { name: 'Twitch', href: 'https://www.twitch.tv/', img: 'twitch_.png' },
  { name: 'Youtube', href: 'https://www.youtube.com/', img: 'Youtube_logo.png' },
  { name: 'Twitter', href: 'https://twitter.com/', img: 'twitter-logo-6.png' },
  { name: 'Netflix', href: 'https://www.netflix.com/', img: 'netflix_logo_icon_170919.png' },
  { name: 'Spotify', href: 'https://www.spotify.com/', img: 'spotify-logoEdited.png' },
  { name: 'iTunes', href: 'https://www.apple.com/itunes/', img: 'ituneslogo.png' },
  { name: '21Buttons', href: 'https://www.21buttons.com/', img: 'cbd6803ce32d2bbc9b4f00a6a92932bf.jpg' },
  { name: 'Discord', href: 'https://discord.com/', img: 'Discord-Logo.png' },
  { name: 'Amazon', href: 'https://www.amazon.com/', img: 'Logotipo-Amazon.jpg' },
  { name: 'Instagram', href: 'https://www.instagram.com/', img: 'Instagram_icon.png' },
];

export function WorldSidebar({
  onControlPanel,
  onAddPost,
  section,
  activeNav = 'world',
}: {
  onControlPanel?: () => void;
  onAddPost?: () => void;
  section?: string;
  activeNav?: 'world' | 'feed' | 'wall' | 'posts';
} = {}) {
  useLayoutPageStyles();
  const { t } = useTranslation('content');
  const { t: tUi } = useTranslation('ui');
  const { t: tNav } = useTranslation('nav');
  const { user: authUser } = useAuth();
  const { t: tFooter } = useTranslation('footer');
  // Streaming modal — port of #streamingModalCenter. Guests see "NOT ON AIR"; a logged-in
  // creator gets the Go-Live bio/tags form (→ /create-room → /start-stream/:room).
  const [streamOpen, setStreamOpen] = useState(false);
  const monoFont =
    "Consolas, Menlo, Monaco, 'Lucida Console', 'Liberation Mono', 'DejaVu Sans Mono', 'Bitstream Vera Sans Mono', 'Courier New', monospace, serif";

  return (
    <>
    <aside id="fh5co-aside" role="complementary" className="border js-fullheight">
      <h1 id="fh5co-logo" style={{ marginBottom: 0 }}>
        <a href={authUser ? '/user' : '/'}>
          {/* the artwork on the front, this account's picture on the back —
              turns when the sidebar opens (see FlipLogo) */}
          <FlipLogo
            picture={authUser?.profilePicture ?? null}
            ring={authUser?.profilePictureBorderStatus === '1'}
          />
        </a>
      </h1>

      <p
        style={{
          marginBottom: 0,
          border: '5px solid black',
          color: '#c3c3c3',
          backgroundColor: '#585858',
          fontFamily: monoFont,
          paddingLeft: 6,
          paddingRight: 6,
          fontSize: 14,
          width: '50%',
          marginLeft: 'auto',
          marginRight: 'auto',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <span style={{ width: 20, height: 20, background: '#585858', position: 'absolute', zIndex: 2, left: 0 }}></span>
        {/* ESTADO — the dot David circled (30 Sep 2026). Two of them, as the blade
            has it: this one is pinned over the mask at the left edge so it is always
            visible, and the one below rides in the text and scrolls away with a long
            nickname. Both were a hardcoded green; both now show the real status and
            follow it live over the socket. */}
        <PresenceDot
          userId={authUser?.id}
          presence={authUser?.presence}
          size={10}
          style={{
            marginRight: 5,
            verticalAlign: 'middle',
            zIndex: 3,
            position: 'absolute',
            left: 5,
            top: 5,
          }}
        />
        <PresenceDot
          userId={authUser?.id}
          presence={authUser?.presence}
          size={10}
          style={{ marginRight: 5, verticalAlign: 'middle' }}
        />{' '}
        {/* `transform: translateX(55%)` inline, as the blade has it — the piece
            that makes the animation start from the right. */}
        <span style={{ display: 'inline-block', transform: 'translateX(55%)' }} className="arrow">
          {authUser ? `@${authUser.usernameUrl ?? ''}` : t('superfans_world', { defaultValue: 'SUPER WORLD' })}
        </span>
      </p>

      {/* Logged-in: non-clickable section label under the username pill
          (user/world.blade L1272-1286 "WORLD", user/feed "MY FEED", …). */}
      {authUser && (
        <ul style={{ listStyleType: 'none', fontSize: 14, width: '100%', padding: '0px 26%' }}>
          <li style={{ textAlign: 'center' }}>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              style={{
                pointerEvents: 'none',
                textTransform: 'uppercase',
                color: '#222',
                fontSize: '0.83em',
                fontFamily: monoFont,
              }}
            >
              {section ?? tNav('world', { defaultValue: 'World' })}
            </a>
          </li>
        </ul>
      )}

      <center>
        <nav id="fh5co-main-menu" role="navigation">
          <ul>
            <li style={{ marginTop: 20 }}>
              <a
                className="streaming_anchor"
                style={{ cursor: 'pointer', marginBottom: 0 }}
                onClick={() => setStreamOpen(true)}
              >
                <span
                  style={{
                    width: 17,
                    height: 17,
                    backgroundColor: 'red',
                    display: 'inline-block',
                    borderRadius: 30,
                    border: '4px solid black',
                    position: 'relative',
                    top: 3,
                  }}
                ></span>{' '}
                {tUi('nav_streaming')}
              </a>
            </li>

            <li>
              <div>
                <NetworkSlider
                  items={WORLD_NETWORKS.map((n) => ({
                    name: n.name,
                    href: n.href,
                    /* the client's SVG set; the legacy bitmap stays as the fallback */
                    src: networkLogo(n.name, 'scroll') ?? assetImage(n.img),
                  }))}
                  style={{ marginTop: 30 }}
                />
              </div>
            </li>

            <hr style={{ marginBottom: 20, marginTop: 10 }} />

            {authUser ? (
              /* user/world.blade.php:1492 — the logged-in nav. Its collapse carries
                 all three entries: the control panel at :1524 plus add post at
                 :1548 and messages at :1554, which sit after the {{-- --}} comment
                 closes and so render too. */
              <LoggedInNav
                active={activeNav}
                hrMarginTop={-17}
                showAddPost
                showMessages
                onAddPost={onAddPost}
                onControlPanel={onControlPanel}
              />
            ) : (
              /* world.blade.php:1492 marks this item fh5co-active on the world
                 page — black text plus the permanently drawn red rule. The
                 logged-in nav already does this; the guest one never did. */
              <li
                className={`${activeNav === 'world' ? 'fh5co-active ' : ''}login_btn world_after`}
                style={{ marginTop: -5, marginBottom: 20 }}
              >
                <a href="/world">
                  <b>{tNav('world', { defaultValue: 'World' })}</b>
                </a>
              </li>
            )}

            <hr style={{ marginTop: -10, marginBottom: 20 }} />

            <li>
              <InfluencerSearch placeholder={tNav('search_influencer', { defaultValue: 'Search influencer' })} />
            </li>
            <br />
            <hr style={{ marginTop: -10 }} />
          </ul>
        </nav>

        <div className="fh5co-footer" style={{ position: 'relative', bottom: 0 }}>
          <ul>
            <li className="nav-item mx-2">
              {authUser ? (
                <Link
                  className="btn btn-danger power-btn"
                  style={{
                  }}
                  to="/logout"
                >
                  <i className="fa fa-power-off" aria-hidden="true"></i>
                </Link>
              ) : (
                <a
                  className="btn btn-outline power-btn"
                  style={{
                    backgroundColor: '#724BB6',
                    borderColor: '#724BB6',
                    color: 'white',
                  }}
                  href="/login"
                >
                  <i className="fa fa-power-off" aria-hidden="true"></i>
                </a>
              )}
            </li>
          </ul>
          <br />
          <p>
            <small>
              <span>
                <a href="/super-ads" target="_blank" style={{ color: 'gray' }}>
                  🏢: SUPER ADS CENTER
                </a>{' '}
              </span>
              <br />{tUi('copyright_line')} <br />
              All Rights Reserved.{' '}
              <span>
                {tFooter('powered_by', { defaultValue: 'Powered by' })} <a href="/world">SUPERFANSS.APP</a>
              </span>
            </small>
          </p>
          <FooterLanguageSelector />
        </div>
      </center>
    </aside>

    <StreamModal open={streamOpen} onClose={() => setStreamOpen(false)} />
    </>
  );
}

interface WorldItem {
  type: 'post' | 'ad';
  id: string;
  imageVideo?: string | null;
  thumbnail?: string | null;
  noOfLikes?: number;
  likesTotal?: number;
  /** the eye */
  views?: number;
  likesCount?: number;
  hatesCount?: number;
  likePercent?: number | null;
  viewerLiked?: boolean;
  viewerHated?: boolean;
  tags?: string[];
  taggedProfilePictures?: string[];
  media?: string;
  link?: string;
  /** an ad's own id and type — a clients-form ad draws its lead form instead of a link */
  adId?: string;
  adType?: string | null;
  influencer?: {
    id?: string;
    usernameUrl: string | null;
    profilePicture: string | null;
    verified: boolean;
    viewerFollowing?: boolean;
  } | null;
}

const REPORT_REASONS: [string, string][] = [
  ['Excessive sensuality', 'sensuality'],
  ['Impersonation', 'impersonation'],
  ['Violence', 'violence'],
  ['Racism', 'racism'],
  ['Other', 'other'],
];

function WorldPostCard({
  item,
  onReport,
  worldRun,
  worldPage,
  worldLastPage,
}: {
  item: WorldItem;
  onReport: (postId: string, reason: string) => void;
  /* the feed's own run, ads and all, so the viewer scrolls what the wall shows */
  worldRun: WorldStep[];
  /* and where it reached, so the viewer can ask for the next page rather than stopping */
  worldPage: number;
  worldLastPage: number;
}) {
  const { user: authUser } = useAuth();
  const { t: tReport } = useTranslation('report');
  const { t: tUi } = useTranslation('ui');
  /* pinned to the top of the screen on a phone (report-menu.css); it must leave
     the card to do that, since an ancestor's transform would otherwise become
     the containing block for `position: fixed` */
  const onPhone = typeof window !== 'undefined' && window.innerWidth <= 768;
  /* The list, its close-out sheet and the ✕ all leave the card: an ancestor of the feed
     card carries a transform, which would otherwise become the containing block for
     `position: fixed` and pin them to the card instead of the viewport. */
  const renderReportMenu = (node: React.ReactNode) => createPortal(node, document.body);
  const registerModal = useRegisterModal();
  const navigate = useNavigate();
   const [reportOpen, setReportOpen] = useState(false);
  /* the share row's confirmation — same dialog the wall and full-screen viewer use */
  const [shareSwal, setShareSwal] = useState<{ icon: 'success' | 'error'; title: string } | null>(null);
  /* the arrow, so the list pins to it in viewport coordinates */
  const reportBtnRef = useRef<HTMLButtonElement>(null);
  /* the post card itself, so the list can be aligned to the post's own edges */
  const cardRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [liked, setLiked] = useState(item.viewerLiked ?? false);
  const [hated, setHated] = useState(item.viewerHated ?? false);
/* The eye is the view count now, not the like count (David, 1 Oct 2026). `views` falls back
   to the old figure so a payload that has not been updated keeps showing what it shows
   today rather than dropping to zero. */
  const [views] = useState(item.views ?? item.likesTotal ?? item.noOfLikes ?? 0);
  /* the pill runs on the real rows only */
  const [likes, setLikes] = useState(item.likesCount ?? 0);
  const [hates, setHates] = useState(item.hatesCount ?? 0);
  const [heartShow, setHeartShow] = useState(false);
  /* blade: the coin + heartbeat on a like, the woosh + poop bounce on a hate */
  const feedback = useRatingFeedback();
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const username = item.influencer?.usernameUrl ?? 'unknown';
  const profilePicture = item.influencer?.profilePicture || 'output-onlinepngtools (2).png';
  const media = item.imageVideo ?? '';
    const taggedUsers = (item.tags ?? []).map((s) => s.trim()).filter(Boolean);
  const taggedPics = item.taggedProfilePictures ?? [];

  /* pin the list to the arrow it opened from: measured at open time and again on
     scroll/resize, because the arrow travels with the wall as the reader scrolls */
  useEffect(() => {
    if (!reportOpen) return;
    const place = () => {
      /* the arrow gives the top (just under the heading strip), the card gives the
         left edge and the width — so the list sits exactly over the post, at the
         post's own size, rather than hanging off the arrow's right corner. */
      const btn = reportBtnRef.current?.getBoundingClientRect();
      /* cardRef sits on the media wrapper itself, so its own rect is the post's own
         rect — no need to reach inside it for a nested element */
      const card = cardRef.current?.getBoundingClientRect();
      if (!btn || !card) return;
      setMenuPos({
        top: btn.bottom + 6,
        left: card.left,
        width: card.width,
      });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [reportOpen]);

  /* 📤 Share post, first row, exactly as the full-screen viewer leads with it — same
     wording (report.share.post), same address (/user/post_detail/<id>), same
     confirmation (report.share.copied / .failed). */
  function copyPostLink() {
    setReportOpen(false);
    const write = navigator.clipboard?.writeText(
      `${window.location.origin}/user/post_detail/${item.id}`,
    );
    if (!write) {
      setShareSwal({ icon: 'error', title: tReport('share.failed') });
      return;
    }
    void write
      .then(() => setShareSwal({ icon: 'success', title: tReport('share.copied') }))
      .catch(() => setShareSwal({ icon: 'error', title: tReport('share.failed') }));
  }

  /** blade like_dislike_post: toggles the like and updates the count optimistically. */


  /** blade like_dislike_post: toggles the like and updates the count optimistically. */
  // function toggleLike() {
  //   api
  //     .post<{ data: { status: string; likesTotal: number; likesCount: number; hatesCount: number } }>(
  //       `/posts/${item.id}/like-toggle`,
  //     )
  //     .then((r) => {
  //       const nowLiked = r.data.data.status === 'post liked';
  //       setLiked(nowLiked);
  //       if (nowLiked) setHated(false);
  //       setLikesTotal(r.data.data.likesTotal);
  //       setLikes(r.data.data.likesCount);
  //       setHates(r.data.data.hatesCount);
  //       feedback.onLiked();
  //     })
  //     .catch(() => {});
  // }
function toggleLike() {
  feedback.onLiked();

  const willBeLiked = !liked;
  setLiked(willBeLiked);
  if (willBeLiked) {
    setHated(false);
    setLikes((prev) => prev + 1);
    if (hated) setHates((prev) => prev - 1);
  } else {
    setLikes((prev) => prev - 1);
  }
  /* a like does not move the eye — that was the client's second note */

  api
    .post<{ data: { status: string; likesTotal: number; likesCount: number; hatesCount: number } }>(
      `/posts/${item.id}/like-toggle`,
    )
    .then((r) => {
      const nowLiked = r.data.data.status === 'post liked';
      setLiked(nowLiked);
      if (nowLiked) setHated(false);
      setLikes(r.data.data.likesCount);
      setHates(r.data.data.hatesCount);
    })
    .catch((err) => {
        // If 401, keep the optimistic state – interceptor will retry
      if (err?.response?.status === 401) {
        console.log('🔄 Token expired – keeping optimistic state');
        return;
      }
      // Revert – undo the optimistic changes
      setLiked(!willBeLiked);
      if (willBeLiked) {
        // We had increased likes, so decrease back
        setLikes((prev) => prev - 1);
        if (hated) setHates((prev) => prev + 1);
      } else {
        // We had decreased likes, so increase back
        setLikes((prev) => prev + 1);
      }
      /* nothing to undo on the eye: a like never moved it */
    });
}
  /** the pill's 💩 half — /me/hate, the same endpoint the full-screen viewer uses. */
  // function toggleHate() {
  //   api
  //     .post<{ data: { status: string; likesCount: number; hatesCount: number } }>(`/me/hate/${item.id}`)
  //     .then((r) => {
  //       const nowHated = r.data.data.status === 'post hated';
  //       setHated(nowHated);
  //       if (nowHated) setLiked(false);
  //       setLikes(r.data.data.likesCount);
  //       setHates(r.data.data.hatesCount);
  //       feedback.onHated();
  //     })
  //     .catch(() => {});
  // }
function toggleHate() {
  feedback.onHated();

  const willBeHated = !hated;
  setHated(willBeHated);
  if (willBeHated) {
    setLiked(false);
    setHates((prev) => prev + 1);
    if (liked) setLikes((prev) => prev - 1);
  } else {
    setHates((prev) => prev - 1);
  }

  api
    .post<{ data: { status: string; likesCount: number; hatesCount: number } }>(`/me/hate/${item.id}`)
    .then((r) => {
      const nowHated = r.data.data.status === 'post hated';
      setHated(nowHated);
      if (nowHated) setLiked(false);
      setLikes(r.data.data.likesCount);
      setHates(r.data.data.hatesCount);
    })
    .catch((err) => {
        // If 401, keep the optimistic state – interceptor will retry
      if (err?.response?.status === 401) {
        console.log('🔄 Token expired – keeping optimistic state');
        return;
      }
      // Revert
      setHated(!willBeHated);
      if (willBeHated) {
        // We had increased hates, so decrease back
        setHates((prev) => prev - 1);
        if (liked) setLikes((prev) => prev + 1);
      } else {
        // We had decreased hates, so increase back
        setHates((prev) => prev + 1);
      }
    });
}
  /* guests get the register modal here exactly as they do on the media */
  const guardGuest = (run: () => void) => () => {
    if (!authUser) {
      registerModal.open();
      return;
    }
    run();
  };

  /** the big heart that flies over the card, whichever of the two below fired it */
  function showHeart() {
    setHeartShow(true);
    setTimeout(() => setHeartShow(false), 600);
  }

  /* The media double-click only ever likes — it never takes a like back. The viewer
     behaves this way already (PostFullscreen.onMediaTap), and these cards used to toggle,
     so the same gesture gave opposite results on the two screens and a second accidental
     double-click quietly dropped the like. The heart and the sound still answer every
     double-click, liked or not. */
  function fireHeart() {
    if (liked) feedback.onLiked();
    else toggleLike();
    showHeart();
  }

  /* The pill's own heart is a deliberate press, so it works both ways — it is how a like
     is taken back now that the double-click above never does. The pill used to call
     fireHeart too, and that left a liked post with no way to unlike it from this page. */
  function pressHeart() {
    toggleLike();
    showHeart();
  }

  /**
   * blade world click handler: on the media/view-count, a 350ms timer distinguishes
   * single-click (record visit → open post detail) from double-click (like + heart).
   * Guests get the register modal instead.
   */
  function onMediaClick(e: React.MouseEvent) {
    e.preventDefault();
    if (!authUser) {
      registerModal.open(); // blade: data-target="#register_Modal"
      return;
    }
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      fireHeart();
    } else {
      /* Note the row and the hand of posts here, in the click itself. Reading
         them from inside the callbacks below recorded a scroll of 0: by then
         the 350ms double-click window and the visit request have passed, and
         the page has been laid out for the viewer. */
      rememberScroll(); // so closing the viewer returns to this row
      markFeedReturn(); // ...beside the same posts, not a fresh shuffle
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null;
        api
          .post(`/posts/${item.id}/visit`)
          .finally(() => {
            /* World context: full-screen scroll navigates the WORLD feed sequence
               (David) — passed via router state, not the profile's own posts. */
            navigate(`/user/post_detail/${item.id}`, {
              state: { world: worldRun, worldPage, worldLastPage },
            });
          });
      }, 350);
    }
  }

  return (
    <div className="col-md-4 col-sm-6 col-xs-6 col-xxs-12 work-item" style={{ marginBottom: 20 }}>
      <div className={`animated-heart${heartShow ? ' show' : ''}`} id={`heart-${item.id}`}></div>
      <PostHeading
        author={{
          usernameUrl: username,
          profilePicture,
          verified: item.influencer?.verified,
        }}
        tagged={taggedUsers.map((name, i) => ({ usernameUrl: name, profilePicture: taggedPics[i]?.trim() || null }))}
        right={
          <button
            ref={reportBtnRef}
            className="report-button-inline report-mobile"
            onClick={(e) => {
              e.stopPropagation();
              setReportOpen((v) => !v);
            }}
            style={{ background: 'transparent', border: 0, cursor: 'pointer' }}
          >
            <img
              src={assetImage('arrowDown_.png')}
              alt="▼"
              style={{ width: 12, height: 12, position: 'relative', bottom: 3, right: 2, display: 'inline-block' }}
            />
          </button>
        }
      />

      <div ref={cardRef} className="image-hover-wrapper" style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
        {isVideoFile(media) ? (
          <div className="video-wrapper" style={{ position: 'relative', width: '100%' }}>
            {/* No native control bar: the mute button beside it is the control, and two of
                them stacked on one card is what the client asked to be rid of. The blade
                draws the bar for a creator you follow (world.blade.php:2293) — running that
                page shows only the mute button, since almost nothing in the feed is someone
                you follow, and the wall never drew one at all. */}
            <video
              className="autoplay-video"
              id={`video-${item.id}`}
              controlsList="nodownload"
              style={{ maxWidth: '100%' }}
              loop
              muted
              playsInline
              poster={item.thumbnail ? assetImage(`thumbnails/${item.thumbnail}`) : undefined}
            >
              <source src={assetImage(media)} type={videoMime(media)} />
            </video>
            <a
              href="#"
              onClick={onMediaClick}
              style={{ position: 'absolute', inset: 0, zIndex: 100, cursor: 'pointer' }}
            ></a>
            <VolumeButton videoId={`video-${item.id}`} variant="world" />
          </div>
        ) : (
          <a href="#" onClick={onMediaClick} style={{ cursor: 'pointer' }}>
            <img
              src={assetImage(media)}
              alt={tUi('alt_post_image')}
              className="img-responsive posttt-img"
              style={{ borderRadius: 26, border: '7px solid lightgray', width: '100%' }}
            />
          </a>
        )}

        {/* close-out sheet — dims the page and takes the click that closes the menu */}
        {reportOpen && renderReportMenu(
          <div className="report-menu-backdrop" onClick={() => setReportOpen(false)} />
        )}


        {reportOpen && renderReportMenu(
          <div
            className="report-menu"
            onClick={(e) => e.stopPropagation()}
                       style={{
              position: 'fixed',
              top: menuPos?.top,
              left: menuPos?.left,
              width: menuPos?.width,
              zIndex: 100000,
            }}
          >
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                background: '#fff',
                border: '1px solid #ccc',
                borderRadius: 8,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                overflow: 'hidden',
                width: '100%',
                fontSize: onPhone ? 14 : 11,
              }}
            >
              <li style={{ borderBottom: '1px solid #eee' }}>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    copyPostLink();
                  }}
                  style={{ display: 'block', padding: '10px 15px', textDecoration: 'none', color: '#333' }}
                >
                  📤 {tReport('share.post')}
                </a>
              </li>
              {REPORT_REASONS.map(([reason, key]) => (
                <li key={reason} style={{ borderBottom: '1px solid #eee' }}>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setReportOpen(false);
                      onReport(item.id, reason);
                    }}
                    style={{ display: 'block', padding: '10px 15px', textDecoration: 'none', color: '#333' }}
                  >
                    {tReport(`reasons.${key}`, { defaultValue: reason })}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {shareSwal && <SwalResult {...shareSwal} onClose={() => setShareSwal(null)} />}
      </div>

      <div className="stats-wrapper has-actions">
        <div className="view-count" onClick={onMediaClick}>
          <span className="eye-icon">👁️</span>
          <span className="number_of_post_likes" style={liked ? { color: '#da1212' } : undefined}>
            {formatNumberRounded(views)}
          </span>
        </div>
        <RatingPill
          pct={likePercent(likes, hates, item.likePercent, {
            id: item.id,
            views: item.views ?? item.likesTotal ?? item.noOfLikes,
          })}
          liked={liked}
          hated={hated}
          beat={feedback.beat}
          bounce={feedback.bounce}
          onLike={guardGuest(pressHeart)}
          onHate={guardGuest(toggleHate)}
        />
      </div>
    </div>
  );
}

/** World discovery feed — port of world.blade.php (guest /world). */
export function World() {
  const { t } = useTranslation('content');
  const { t: tReport } = useTranslation('report');
  const [controlPanelOpen, setControlPanelOpen] = useState(false);
  const [addPostOpen, setAddPostOpen] = useState(false);
  const { t: tUi } = useTranslation('ui');
  /* Stepping back into the feed replays the posts that were on screen, rather
     than asking for a fresh shuffle that would put strangers where the reader
     left off. Clicking World or reloading still deals a new hand. Read once, at
     the first render, so the decision cannot change underneath the effects. */
  const [remembered] = useState(() => recallFeed<WorldItem>(window.location.pathname));

  const [items, setItems] = useState<WorldItem[]>(remembered?.items ?? []);
  /* come back from the viewer beside the post that was opened, not at the top */
  useScrollMemory(items.length > 0);
  const [page, setPage] = useState(remembered?.page ?? 1);
  const [lastPage, setLastPage] = useState(remembered?.lastPage ?? 1);
  const [loading, setLoading] = useState(false);
  const [swal, setSwal] = useState<{ icon: 'success' | 'error'; title: string; text: string } | null>(null);
  /* the replayed pages are already in hand, so infinite scroll resumes past them */
  const loadedPages = useRef(
    new Set<number>(
      remembered ? Array.from({ length: remembered.page }, (_, i) => i + 1) : [],
    ),
  );

  const loadPage = useCallback((p: number) => {
    if (loadedPages.current.has(p)) return;
    loadedPages.current.add(p);
    setLoading(true);
    api
      .get<{ success: boolean; data: { items: WorldItem[]; lastPage: number } }>(`/world?page=${p}&seed=${WORLD_SEED}`)
      .then((r) => {
        /* Defence in depth: the backend now hands out one stable, cached pool per five-minute
           window (world.routes.ts) so a later page should never repeat an earlier one's posts,
           but the 3 ads on each page are still sampled fresh every request and can coincide.
           Without this an id appearing twice rendered two identical cards — the same glitch
           the full-screen reel guards against in worldSequence.ts's appendSteps. */
        setItems((prev) => {
          const seen = new Set(prev.map((it) => it.id));
          const fresh = r.data.data.items.filter((it) => !seen.has(it.id));
          return [...prev, ...fresh];
        });
        setLastPage(r.data.data.lastPage);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    document.title = 'Superfans | World';
    if (!remembered) loadPage(1);
  }, [loadPage, remembered]);

  /* keep the saved copy level with what is on screen, so a step away at any
     point in the scroll comes back to the same place */
  useEffect(() => {
    if (items.length) rememberFeed({ items, page, lastPage });
  }, [items, page, lastPage]);

  /* videos have no autoplay attr — the IntersectionObserver drives playback (blade parity) */
  useEffect(() => {
    observeNewVideos();
  }, [items]);

  /* infinite scroll (blade's loaderz spinner behavior) */
  useEffect(() => {
    function onScroll() {
      if (loading || page >= lastPage) return;
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 600) {
        const next = page + 1;
        setPage(next);
        loadPage(next);
      }
    }
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, [loading, page, lastPage, loadPage]);

  function reportPost(postId: string, reason: string) {
    api
      .post('/users/reports/post', { postId, reason })
      .then(() => setSwal({ icon: 'success', title: tReport('sent_title'), text: tReport('thank_you') }))
      .catch(() => setSwal({ icon: 'error', title: tReport('failed_title'), text: tReport('failed_message') }));
  }

  return (
    <div id="fh5co-page">
      <PageLoader />
      {swal && <SwalResult {...swal} onClose={() => setSwal(null)} />}
      <NavToggle />
      <MobileFooterMenu />

      <GuestHeader usernameUrl="" />
      <WorldSidebar
        onControlPanel={() => setControlPanelOpen(true)}
        onAddPost={() => setAddPostOpen(true)}
      />
      <ControlPanelHost open={controlPanelOpen} onClose={() => setControlPanelOpen(false)} />
      <AddPostHost open={addPostOpen} onClose={() => setAddPostOpen(false)} />

      <div id="fh5co-main">
        <div className="fh5co-narrow-content">
          <center>
            <img src="/assets/images/SUPERHEROINA.svg" style={{ width: '12.9em' }} alt="" />
            <div
              className="welcome-row"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                marginTop: 10,
                flexWrap: 'wrap',
              }}
            >
              <h2
                className="fh5co-heading animate-box tittlei"
                style={{ fontFamily: "'Roboto Slab', serif", color: '#dd2110', margin: 0 }}
              >
                <span>
                  <img
                    src={assetImage('Captura de pantalla 2025-04-28 011318.png')}
                    style={{ width: '1.15em', display: 'inline-block' }}
                    alt=""
                  />{' '}
                  {t('superfans_world_welcome', { defaultValue: 'Welcome to' })}
                  <br />
                  {t('superfans_world', { defaultValue: 'SUPER WORLD' })}
                </span>
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 40 }}>
                <Link to="/rankings" className="btn-dark btn">
                  🏆 {t('see_rankings', { defaultValue: 'See Rankings' })}
                </Link>
                <span className="tooltip-container" style={{ fontSize: 20, fontWeight: 700, color: '#000' }}>
                  ⓘ
                  <span
                    className="tooltip-text"
                    dangerouslySetInnerHTML={{ __html: t('rank_msg', { defaultValue: '' }) }}
                  />
                </span>
              </div>
            </div>
          </center>

          <div className="row animate-box" style={{ display: 'block', flexWrap: 'wrap' }}>
            {items.length > 0 ? (
              <div id="post-container">
                {(() => {
                  /* ads included, and in the feed's order: the viewer shows them where the
                     wall does rather than skipping to the next post */
                  const worldRun = toSteps(items);
                  return items.map((item) =>
                    item.type === 'ad' ? (
                      <AdCard key={item.id} item={item} />
                    ) : (
                      <WorldPostCard
                        key={item.id}
                        item={item}
                        onReport={reportPost}
                        worldRun={worldRun}
                        worldPage={page}
                        worldLastPage={lastPage}
                      />
                    ),
                  );
                })()}
              </div>
            ) : (
              !loading && (
                <div style={{ textAlign: 'center', marginTop: 50 }}>
                  <p>{tUi('no_posts_available')}</p>
                </div>
              )
            )}
          </div>
        </div>

        {loading && (
          <div style={{ justifyContent: 'center', alignItems: 'center', width: '100%', textAlign: 'center', display: 'flex' }}>
            <img src={assetImage('spinner.gif')} alt={tUi('loading')} style={{ width: 50 }} />
          </div>
        )}
      </div>
    </div>
  );
}
