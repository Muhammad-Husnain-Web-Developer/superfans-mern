import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { assetImage, formatNumberRounded, isVideoFile, videoMime } from '../../utils/format';
import { observeNewVideos } from '../../utils/video';
import { useAuth } from '../../context/AuthContext';
import { FooterLanguageSelector, GuestHeader, InfluencerSearch, LoggedInNav } from '../profile/ProfileSidebar';
import { VolumeButton } from '../../components/VolumeButton';
import { useRegisterModal } from '../../components/RegisterModal';
import { PageLoader } from '../../components/PageLoader';
import { NavToggle } from '../../components/NavToggle';
import { MobileFooterMenu } from '../../components/MobileFooterMenu';
import { SwalResult } from '../profile/Profile';
import '../../styles/profile-page.css';
import '../../styles/world-page.css';
import { useLayoutPageStyles } from '../../components/StandalonePage';
import { ControlPanelHost } from '../profile/ControlPanelHost';

/* The hardcoded network slider of world.blade.php (11 items, per-item icon styles) */
const WORLD_NETWORKS: { name: string; href: string; img: string; style?: React.CSSProperties }[] = [
  { name: 'TikTok', href: 'https://www.tiktok.com/', img: 'b05db292060a4b42799ad7abaf5d6130.png' },
  { name: 'Twitch', href: 'https://www.twitch.tv/', img: 'twitch_.png', style: { width: 75, marginTop: -6 } },
  { name: 'Youtube', href: 'https://www.youtube.com/', img: 'Youtube_logo.png', style: { marginTop: 10 } },
  { name: 'Twitter', href: 'https://twitter.com/', img: 'twitter-logo-6.png' },
  { name: 'Netflix', href: 'https://www.netflix.com/', img: 'netflix_logo_icon_170919.png' },
  { name: 'Spotify', href: 'https://www.spotify.com/', img: 'spotify-logoEdited.png', style: { width: 75, marginTop: -6 } },
  { name: 'iTunes', href: 'https://www.apple.com/itunes/', img: 'ituneslogo.png' },
  { name: '21Buttons', href: 'https://www.21buttons.com/', img: 'cbd6803ce32d2bbc9b4f00a6a92932bf.jpg' },
  { name: 'Discord', href: 'https://discord.com/', img: 'Discord-Logo.png', style: { width: 75, marginTop: 4 } },
  { name: 'Amazon', href: 'https://www.amazon.com/', img: 'Logotipo-Amazon.jpg' },
  { name: 'Instagram', href: 'https://www.instagram.com/', img: 'Instagram_icon.png' },
];

export function WorldSidebar({
  onControlPanel,
  section,
  activeNav = 'world',
}: {
  onControlPanel?: () => void;
  section?: string;
  activeNav?: 'world' | 'feed' | 'wall' | 'posts';
} = {}) {
  useLayoutPageStyles();
  const { t } = useTranslation('content');
  const { t: tNav } = useTranslation('nav');
  const { user: authUser } = useAuth();
  const { t: tFooter } = useTranslation('footer');
  const [slide, setSlide] = useState(0);
  const navigate = useNavigate();
  // Streaming modal — port of #streamingModalCenter. Guests see "NOT ON AIR"; a logged-in
  // creator gets the Go-Live bio/tags form (→ /create-room → /start-stream/:room).
  const [streamOpen, setStreamOpen] = useState(false);
  const [streamBio, setStreamBio] = useState('');
  const [streamTags, setStreamTags] = useState('');
  const [streamBusy, setStreamBusy] = useState(false);
  async function submitGoLive(e: React.FormEvent) {
    e.preventDefault();
    if (!streamBio.trim() || !streamTags.trim() || streamBusy) return;
    setStreamBusy(true);
    try {
      const { data } = await api.post<{ roomName: string }>('/create-room', {
        bio: streamBio.trim(),
        tags: streamTags.trim(),
      });
      if (data.roomName) navigate(`/start-stream/${data.roomName}`);
    } catch {
      setStreamBusy(false);
    }
  }
  const monoFont =
    "Consolas, Menlo, Monaco, 'Lucida Console', 'Liberation Mono', 'DejaVu Sans Mono', 'Bitstream Vera Sans Mono', 'Courier New', monospace, serif";
  const current = WORLD_NETWORKS[((slide % WORLD_NETWORKS.length) + WORLD_NETWORKS.length) % WORLD_NETWORKS.length];

  return (
    <>
    <aside id="fh5co-aside" role="complementary" className="border js-fullheight">
      <h1 id="fh5co-logo" style={{ marginBottom: 0 }}>
        <a href={authUser ? '/user' : '/'}>
          <img src="/assets/images/SUPERHEROINA.svg" style={{ width: '54%' }} alt="" />
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
        <span
          style={{
            width: 10,
            height: 10,
            backgroundColor: '#0ed145',
            display: 'inline-block',
            marginRight: 5,
            borderRadius: 30,
            verticalAlign: 'middle',
            zIndex: 3,
            position: 'absolute',
            left: 5,
            top: 5,
          }}
        ></span>
        <span
          style={{
            width: 10,
            height: 10,
            backgroundColor: '#0ed145',
            display: 'inline-block',
            marginRight: 5,
            borderRadius: 30,
            verticalAlign: 'middle',
          }}
        ></span>{' '}
        <span style={{ display: 'inline-block' }} className="arrow">
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
                Streaming
              </a>
            </li>

            <li>
              <div>
                <div
                  id="slider_id"
                  className="slider"
                  style={{ width: '100%', margin: 0, height: 120, boxShadow: 'none', marginTop: 30 }}
                >
                  <div className="slider-control next" onClick={() => setSlide((s) => s + 1)}>
                    <i className="fa fa-angle-right" aria-hidden="true" style={{ color: '#060605' }}></i>
                  </div>
                  <div className="slider-control prev" onClick={() => setSlide((s) => s - 1)}>
                    <i className="fa fa-angle-left" aria-hidden="true" style={{ color: '#060605' }}></i>
                  </div>
                  <div className="item active">
                    <div className="item-content">
                      <a href={current.href}>
                        <img
                          src={assetImage(current.img)}
                          width={69}
                          style={{ maxWidth: 69, maxHeight: 69, display: 'inline-block', ...current.style }}
                          alt=""
                        />
                        <br />
                        &nbsp;&nbsp;<b>{current.name}</b>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </li>

            <hr style={{ marginBottom: 20, marginTop: 10 }} />

            {authUser ? (
              /* user/world.blade.php L1492-1527: the logged-in nav, whose collapse
                 here carries only the control panel */
              <LoggedInNav active={activeNav} hrMarginTop={-17} onControlPanel={onControlPanel} />
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
              <br />© 2025 Superfans World S.L <br />
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

    {streamOpen && (
      <div
        onClick={() => setStreamOpen(false)}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 123112311231, overflowY: 'auto' }}
      >
        {/* modal-dialog: 600px, margin 30px auto (top-aligned, horizontally centered) */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ width: 600, maxWidth: 'calc(100% - 20px)', margin: '30px auto', position: 'relative' }}
        >
          <div className="modal-content" style={{ borderRadius: 20, background: 'blueviolet' }}>
            {/* modal-header: padding 15px */}
            <div style={{ border: 0, padding: 15, position: 'relative' }}>
              <button
                type="button"
                onClick={() => setStreamOpen(false)}
                aria-label="Close"
                style={{ float: 'right', fontSize: 45, fontWeight: 700, lineHeight: 1, opacity: 1, color: '#fff', background: 'none', border: 'none', cursor: 'pointer', marginTop: -2, padding: 0 }}
              >
                ×
              </button>
              <div style={{ textAlign: 'center', height: 20, marginTop: 35 }}>
                <img src="/assets/images/superman2.png" style={{ display: 'inline-block', height: 51 }} alt="" />
                <h5 style={{ fontSize: 30, textAlign: 'center', color: '#fff', display: 'inline-block', margin: 0 }}>
                  Message
                </h5>
              </div>
            </div>
            {/* modal-body: padding 15px */}
            <div style={{ border: 0, padding: 15, position: 'relative' }}>
              {authUser ? (
                <form onSubmit={submitGoLive}>
                  <div className="form-group" style={{ display: 'flex' }}>
                    <label style={{ color: '#fff', width: 50 }}>{t('stream_bio')}:</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      required
                      placeholder={t('stream_bio_placeholder')}
                      value={streamBio}
                      onChange={(e) => setStreamBio(e.target.value)}
                      style={{ backgroundColor: '#fff', color: '#000' }}
                    />
                  </div>
                  <div className="form-group mt-3" style={{ display: 'flex', marginTop: 20 }}>
                    <label style={{ color: '#fff', width: 50 }}>{t('stream_tags')}:</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      placeholder={t('stream_tags_placeholder')}
                      value={streamTags}
                      onChange={(e) => setStreamTags(e.target.value)}
                      style={{ backgroundColor: '#fff', color: '#000' }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
                    <button type="submit" className="btn btn-light" disabled={streamBusy} style={{ padding: '10px 20px' }}>
                      🔴 {t('stream_start_button')}
                    </button>
                  </div>
                </form>
              ) : (
                <h3 style={{ color: '#fff', textAlign: 'center', marginTop: 15, fontSize: 24, fontWeight: 700 }}>
                  THIS USER IS NOT ON 🔴 AIR.
                </h3>
              )}
            </div>
          </div>
        </div>
      </div>
    )}
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
  hatesCount?: number;
  viewerLiked?: boolean;
  tags?: string[];
  taggedProfilePictures?: string[];
  media?: string;
  link?: string;
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
  worldIds,
}: {
  item: WorldItem;
  onReport: (postId: string, reason: string) => void;
  worldIds: string[];
}) {
  const { user: authUser } = useAuth();
  const registerModal = useRegisterModal();
  const navigate = useNavigate();
  const [reportOpen, setReportOpen] = useState(false);
  const [liked, setLiked] = useState(item.viewerLiked ?? false);
  const [likesTotal, setLikesTotal] = useState(item.likesTotal ?? item.noOfLikes ?? 0);
  const [heartShow, setHeartShow] = useState(false);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* world-page.css animates .feed_posts_heading_marquee once its container
     carries .is-overflowing, but nothing ever added that class, so the heading
     never scrolled. Measure the run of text against the 150px slot and let the
     ones that do not fit scroll, LED-sign style. */
  const headingRef = useRef<HTMLSpanElement | null>(null);
  const [headingOverflows, setHeadingOverflows] = useState(false);
  const username = item.influencer?.usernameUrl ?? 'unknown';
  const profilePicture = item.influencer?.profilePicture || 'output-onlinepngtools (2).png';
  const media = item.imageVideo ?? '';
  const taggedUsers = (item.tags ?? []).map((s) => s.trim()).filter(Boolean);
  const taggedPics = item.taggedProfilePictures ?? [];

  useEffect(() => {
    const run = headingRef.current;
    const slot = run?.parentElement;
    if (!run || !slot) return;
    const measure = () => setHeadingOverflows(run.scrollWidth > slot.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(slot);
    /* the avatars land after the first paint and lengthen the run */
    const avatars = Array.from(run.querySelectorAll('img'));
    avatars.forEach((img) => img.addEventListener('load', measure));
    return () => {
      observer.disconnect();
      avatars.forEach((img) => img.removeEventListener('load', measure));
    };
  }, [username, taggedUsers.length]);
  /* blade: videos only get native controls if the viewer follows the creator (or owns the post). */
  const canControlVideo = !!authUser && item.influencer?.viewerFollowing === true;

  /** blade like_dislike_post: toggles the like and updates the count optimistically. */
  function toggleLike() {
    api
      .post<{ data: { status: string; likesTotal: number } }>(`/posts/${item.id}/like-toggle`)
      .then((r) => {
        setLiked(r.data.data.status === 'post liked');
        setLikesTotal(r.data.data.likesTotal);
      })
      .catch(() => {});
  }

  function fireHeart() {
    toggleLike();
    setHeartShow(true);
    setTimeout(() => setHeartShow(false), 600);
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
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null;
        api
          .post(`/posts/${item.id}/visit`)
          .finally(() =>
            /* World context: full-screen scroll navigates the WORLD feed sequence
               (David) — passed via router state, not the profile's own posts. */
            navigate(`/user/post_detail/${item.id}`, { state: { world: worldIds } }),
          );
      }, 350);
    }
  }

  return (
    <div className="col-md-4 col-sm-6 col-xs-6 col-xxs-12 work-item" style={{ marginBottom: 20 }}>
      <div className={`animated-heart${heartShow ? ' show' : ''}`} id={`heart-${item.id}`}></div>
      <p
        className="feed_posts_heading_p feed-heading-flex"
        style={{ position: 'relative', top: 25, fontSize: 14, marginBottom: 12 }}
      >
        <span className={`feed_posts_heading_left${headingOverflows ? ' is-overflowing' : ''}`}>
          <span className="feed_posts_heading_marquee" ref={headingRef}>
            <Link
              style={{ color: 'black', display: 'inline-flex', alignItems: 'center', marginRight: 10 }}
              to={`/${username}`}
            >
              <img
                className="feed_posts_heading_img"
                src={assetImage(profilePicture)}
                alt=""
                style={{ marginRight: 10, marginBottom: 0 }}
              />
              <span>@</span>
              {username}
              {item.influencer?.verified && (
                <img
                  src={assetImage('verified.png')}
                  alt="Verified"
                  width={18}
                  height={18}
                  style={{ marginLeft: 5, verticalAlign: 'middle', display: 'inline-block' }}
                />
              )}
            </Link>
            {taggedUsers.map((tagged, i) =>
              taggedPics[i] ? (
                <Link
                  key={tagged}
                  style={{ color: 'black', display: 'inline-flex', alignItems: 'center', marginRight: 10 }}
                  to={`/${tagged}`}
                >
                  <img
                    className="feed_posts_heading_img"
                    src={assetImage(taggedPics[i].trim())}
                    alt=""
                    style={{ marginRight: 10, marginBottom: 0 }}
                  />
                  <span>@{tagged}</span>
                </Link>
              ) : null,
            )}
          </span>
        </span>
        <span className="feed_posts_heading_right">
          <button
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
        </span>
      </p>

      <div className="image-hover-wrapper" style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
        {isVideoFile(media) ? (
          <div className="video-wrapper" style={{ position: 'relative', width: '100%' }}>
            <video
              className="autoplay-video"
              id={`video-${item.id}`}
              controlsList="nodownload"
              style={{ maxWidth: '100%' }}
              controls={canControlVideo}
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
              alt="Post Image"
              className="img-responsive posttt-img"
              style={{ borderRadius: 26, border: '7px solid lightgray', width: '100%' }}
            />
          </a>
        )}

        {reportOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              bottom: 45,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'white',
              border: '1px solid #ccc',
              borderRadius: 6,
              width: '90%',
              zIndex: 10,
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
                fontSize: 11,
              }}
            >
              {REPORT_REASONS.map(([reason]) => (
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
                    {reason}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="stats-wrapper">
        <div className="view-count" onClick={onMediaClick}>
          <span className="eye-icon">👁️</span>
          <span className="number_of_post_likes" style={liked ? { color: '#da1212' } : undefined}>
            {formatNumberRounded(likesTotal)}
          </span>
        </div>
      </div>
    </div>
  );
}

function WorldAdCard({ item }: { item: WorldItem }) {
  const media = item.media ?? '';
  return (
    <div className="col-md-4 col-sm-6 col-xs-6 col-xxs-12 work-item">
      <a href={item.link ?? '#'} target="_blank" rel="noreferrer">
        <p className="feed_posts_heading_p" style={{ position: 'relative', fontSize: 14 }}>
          <span>Super Ads</span>
        </p>
        {isVideoFile(media) ? (
          <video className="autoplay-video" controlsList="nodownload" style={{ maxWidth: '100%' }} controls loop muted playsInline>
            <source src={assetImage(media)} type={videoMime(media)} />
          </video>
        ) : /* ads keep native controls (blade parity) */ (
          <img
            src={assetImage(media)}
            alt="Advertisement"
            className="img-responsive posttt-img"
            style={{ borderRadius: 26, border: '7px solid lightgray', width: '100%' }}
          />
        )}
      </a>
    </div>
  );
}

/** World discovery feed — port of world.blade.php (guest /world). */
export function World() {
  const { t } = useTranslation('content');
  const { t: tReport } = useTranslation('report');
  const [controlPanelOpen, setControlPanelOpen] = useState(false);
  const [items, setItems] = useState<WorldItem[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [swal, setSwal] = useState<{ icon: 'success' | 'error'; title: string; text: string } | null>(null);
  const loadedPages = useRef(new Set<number>());

  const loadPage = useCallback((p: number) => {
    if (loadedPages.current.has(p)) return;
    loadedPages.current.add(p);
    setLoading(true);
    api
      .get<{ success: boolean; data: { items: WorldItem[]; lastPage: number } }>(`/world?page=${p}`)
      .then((r) => {
        setItems((prev) => [...prev, ...r.data.data.items]);
        setLastPage(r.data.data.lastPage);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    document.title = 'Superfans | World';
    loadPage(1);
  }, [loadPage]);

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
      <WorldSidebar onControlPanel={() => setControlPanelOpen(true)} />
      <ControlPanelHost open={controlPanelOpen} onClose={() => setControlPanelOpen(false)} />

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
                  const worldIds = items.filter((i) => i.type !== 'ad').map((i) => i.id);
                  return items.map((item) =>
                    item.type === 'ad' ? (
                      <WorldAdCard key={item.id} item={item} />
                    ) : (
                      <WorldPostCard key={item.id} item={item} onReport={reportPost} worldIds={worldIds} />
                    ),
                  );
                })()}
              </div>
            ) : (
              !loading && (
                <div style={{ textAlign: 'center', marginTop: 50 }}>
                  <p>No posts available yet.</p>
                </div>
              )
            )}
          </div>
        </div>

        {loading && (
          <div style={{ justifyContent: 'center', alignItems: 'center', width: '100%', textAlign: 'center', display: 'flex' }}>
            <img src={assetImage('spinner.gif')} alt="Loading..." style={{ width: 50 }} />
          </div>
        )}
      </div>
    </div>
  );
}
