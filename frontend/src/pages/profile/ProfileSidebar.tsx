import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { closeOffcanvas } from '../../components/NavToggle';
import { api } from '../../api/client';
import { assetImage } from '../../utils/format';
import type { NetworkDetail, ProfileData } from '../../api/profiles';

interface SearchHit {
  name: string;
  verified: boolean;
}

/**
 * Influencer search with suggestions — mirrors the blade's bootstrap-typeahead
 * on `.influencer_search` (verified first, badge in the list, navigate on pick).
 */
export function InfluencerSearch({ placeholder }: { placeholder: string }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  function onChange(value: string) {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    if (!value.trim()) {
      setHits([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(() => {
      api
        .get<{ success: boolean; data: SearchHit[] }>(
          `/users/search/influencers?query=${encodeURIComponent(value)}`,
        )
        .then((r) => {
          setHits(r.data.data);
          setOpen(true);
        })
        .catch(() => setHits([]));
    }, 200);
  }

  return (
    <div className="wrapper" ref={boxRef} style={{ position: 'relative' }}>
      <input
        type="text"
        className="influencer_search"
        placeholder={placeholder}
        value={query}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => hits.length > 0 && setOpen(true)}
      />
      <div className="wrapper_span">🔎</div>
      {open && hits.length > 0 && (
        <ul
          className="typeahead dropdown-menu"
          style={{ display: 'block', top: '100%', left: 0, right: 0, zIndex: 1000 }}
        >
          {hits.map((hit) => (
            <li key={hit.name}>
              <a
                className="dropdown-item"
                href={`/${hit.name}`}
                style={{ display: 'block', padding: '3px 20px', color: '#333', textDecoration: 'none' }}
                onClick={(e) => {
                  e.preventDefault();
                  setOpen(false);
                  setQuery(hit.name);
                  navigate(`/${hit.name}`);
                }}
              >
                {hit.name}
                {hit.verified && (
                  <img
                    src={assetImage('verified.png')}
                    alt="Verified"
                    width={18}
                    height={18}
                    style={{ position: 'relative', bottom: 2, marginLeft: 5, display: 'inline-block' }}
                  />
                )}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const LOCALE_FLAGS: Record<string, string> = {
  en: 'euflag.png',
  es: 'spainflag.png',
  fr: 'fr.png',
  de: 'de.png',
  it: 'it.png',
  pt: 'pt.png',
  ca: 'ca.png',
  cn: 'cn.png',
};

/**
 * Absolute top-right header (layouts_direct_user/header.blade.php):
 * guests see the purple "Login | ⏻" button linking to /login?username=X.
 */
export function GuestHeader({ usernameUrl }: { usernameUrl: string }) {
  const { user: authUser } = useAuth();
  if (authUser) return null; // logged-in header renders nothing (logout is commented out in the blade)
  if (!usernameUrl) return null; // blade renders the button only when $user is set (not on /world)
  return (
    <div className="header_div" style={{ position: 'absolute', width: '100%', zIndex: 2 }}>
      <div className="container-fluid">
        <nav className="navbar navbar-expand-lg navbar-light navbar_heading">
          <div id="navbarSupportedContent">
            <ul
              className="navbar-nav ml-auto"
              style={{ position: 'absolute', top: 10, right: 0, listStyleType: 'none' }}
            >
              <li className="nav-item mx-2">
                {/* not btn-danger: its :hover flashed the button red over the purple
                    inline background. login-btn-top carries both states now. */}
                <a
                  className="btn login-btn-top"
                  style={{ borderRadius: 20 }}
                  href={`/login?username=${usernameUrl}`}
                >
                  <b>Login</b> | <i className="fa fa-power-off" aria-hidden="true"></i>
                </a>
              </li>
            </ul>
          </div>
        </nav>
      </div>
    </div>
  );
}

/** "Language: 🇪🇺 ▼" selector at the very bottom of the aside (blade <footer> block). */
export function FooterLanguageSelector() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const current = i18n.resolvedLanguage ?? 'en';

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);

  return (
    <footer>
      <div style={{ textAlign: 'center', marginTop: '2rem' }}>
        <div className="footer-language-selector" style={{ position: 'relative', display: 'inline-block' }}>
          <button
            className="footer-lang-toggle"
            style={{
              background: 'none',
              border: 'none',
              fontSize: 14,
              fontWeight: 400,
              cursor: 'pointer',
              opacity: 1,
              color: '#000',
            }}
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
          >
            Language:
            <img
              src={assetImage(LOCALE_FLAGS[current] ?? 'euflag.png')}
              alt={current}
              style={{ width: 20, height: 20, verticalAlign: 'middle', marginLeft: 5 }}
            />
            <img
              src={assetImage('arrowDown_.png')}
              alt="▼"
              style={{ width: 12, height: 12, marginLeft: 2 }}
            />
          </button>
          <div
            className="footer-lang-menu"
            style={{
              display: open ? 'block' : 'none',
              position: 'absolute',
              left: '75%',
              bottom: 30,
              background: 'white',
              border: '1px solid #ccc',
              padding: '8px 12px',
              zIndex: 10,
            }}
          >
            {Object.keys(LOCALE_FLAGS)
              .filter((l) => l !== current)
              .map((locale) => (
                <a
                  key={locale}
                  href={`#${locale}`}
                  style={{ textDecoration: 'none', fontSize: 14, fontWeight: 400, display: 'block', padding: '4px 0' }}
                  onClick={(e) => {
                    e.preventDefault();
                    void i18n.changeLanguage(locale);
                    setOpen(false);
                  }}
                >
                  <img
                    src={assetImage(LOCALE_FLAGS[locale])}
                    alt={locale}
                    style={{ width: 20, height: 20, verticalAlign: 'middle', marginRight: 5 }}
                  />
                </a>
              ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

/** Per-network icon tweaks copied from the Blade slider markup. */
function networkIconStyle(id: number): React.CSSProperties {
  if (id === 3 || id === 4) return { maxWidth: 69, maxHeight: 69, marginTop: 10 };
  if (id === 1) return { width: 75, marginTop: -2 };
  if (id === 73) return { width: 75, marginTop: 17 };
  if (id === 71) return { maxWidth: 69, maxHeight: 69, marginRight: 5 };
  if (id === 81 || id === 61) return { maxWidth: 69, maxHeight: 69, marginTop: 5 };
  if (id === 41) return { maxWidth: 69, maxHeight: 69, marginTop: 9 };
  return { maxWidth: 69, maxHeight: 69 };
}

/** Sidebar social-networks slider (#slider_id) with prev/next controls. */
function NetworksSlider({ networks }: { networks: NetworkDetail[] }) {
  const [index, setIndex] = useState(0);
  if (networks.length === 0) return null;
  const current = networks[((index % networks.length) + networks.length) % networks.length];

  return (
    <>
      <div>
        <div
          id="slider_id"
          className="slider"
          style={{ width: '100%', margin: 0, height: 120, boxShadow: 'none' }}
        >
          <div className="slider-control next play-sound2" onClick={() => setIndex((i) => i + 1)}>
            <i className="fa fa-angle-right" aria-hidden="true" style={{ color: '#060605' }}></i>
          </div>
          <div className="slider-control prev play-sound2" onClick={() => setIndex((i) => i - 1)}>
            <i className="fa fa-angle-left" aria-hidden="true" style={{ color: '#060605' }}></i>
          </div>
          <div className="item active">
            <div className="item-content">
              <a href={current.link}>
                <img
                  src={assetImage(current.image)}
                  width={69}
                  style={networkIconStyle(current.id)}
                  alt=""
                />
                <br />
                &nbsp;&nbsp;<b>{current.name}</b>
              </a>
            </div>
          </div>
        </div>
      </div>
      <hr style={{ marginBottom: 20 }} />
    </>
  );
}

const MONO_FONT =
  "Consolas, Menlo, Monaco, 'Lucida Console', 'Liberation Mono', 'DejaVu Sans Mono', 'Bitstream Vera Sans Mono', 'Courier New', monospace, serif";

/**
 * The logged-in sidebar nav — World / Feed / "My" · Wall / Posts, then the @username
 * collapse. Shared by every page that renders the layout chrome so the copies cannot
 * drift; the world page used to show only the guest "World" link.
 *
 * The collapse contents differ per blade: the profile page offers Add post + Control
 * panel + Messages, the world page only Control panel.
 */
export function LoggedInNav({
  active,
  showAddPost = false,
  showMessages = false,
  hrMarginTop = -1,
  onAddPost,
  onControlPanel,
}: {
  active?: 'world' | 'feed' | 'wall' | 'posts';
  showAddPost?: boolean;
  showMessages?: boolean;
  hrMarginTop?: number;
  onAddPost?: () => void;
  onControlPanel?: () => void;
}) {
  const { t } = useTranslation('nav');
  const { user: authUser } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  if (!authUser) return null;

  const base = authUser.role === 'influencer' ? '/influencer' : '/user';

  /** footer.blade.php L4589: on mobile, close the offcanvas first, open 100ms later */
  function handleControlPanel() {
    if (window.innerWidth < 768) closeOffcanvas();
    setTimeout(() => onControlPanel?.(), 100);
  }

  return (
    <>
      <li className={`${active === 'world' ? 'fh5co-active ' : ''}world_after`}>
        <a href={`${base}/world`}>{t('world', { defaultValue: 'World' })}</a>
      </li>
      <li className={active === 'feed' ? 'fh5co-active' : undefined}>
        <a href={`${base}/feed`}>{t('feed', { defaultValue: 'Feed' })}</a>
      </li>
      <li style={{ marginBottom: 5, marginTop: -5 }}>
        <span style={{ fontSize: 13, color: '#c3c3c3', fontFamily: MONO_FONT }}>
          {t('my', { defaultValue: 'My' })}
        </span>
      </li>
      <li className={active === 'wall' ? 'fh5co-active' : undefined}>
        <a href={base}>{t('wall', { defaultValue: 'Wall' })}</a>
      </li>
      <li className={active === 'posts' ? 'fh5co-active' : undefined}>
        <a href={`${base}/posts`}>{t('posts', { defaultValue: 'Posts' })}</a>
      </li>
      <br />
      <hr style={{ marginTop: hrMarginTop }} />

      <li className="username_li" style={{ fontSize: '80%' }}>
        <div className="">
          <p
            id="dropdownMenuButton"
            style={{ cursor: 'pointer', whiteSpace: 'nowrap', transition: '0.3s' }}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <b>@</b>
            <b>
              {authUser.usernameUrl} <i className="far fa-user-circle" style={{ fontSize: 20 }}></i>
            </b>
          </p>
          <div
            className={`collapse-div collapse${menuOpen ? ' in show' : ''}`}
            id="demo"
            style={{
              left: 12,
              padding: 10,
              position: 'relative',
              width: 'fit-content',
              float: 'none',
              boxShadow: 'none',
              border: 0,
            }}
          >
            {showAddPost && (
              <p className="dropdown-item add_post_item" style={COLLAPSE_ITEM} onClick={onAddPost}>
                <i className="fa fa-plus"></i> {t('add_post', { defaultValue: 'Add post' })}
              </p>
            )}
            <p
              className="dropdown-item control_panel_item"
              style={{ ...COLLAPSE_ITEM, marginTop: showAddPost ? 0 : 10 }}
              onClick={handleControlPanel}
            >
              <i className="far fa-user-circle"></i>{' '}
              {t('control_panel', { defaultValue: 'Control Panel' })}
            </p>
            {showMessages && (
              <p
                className="dropdown-item add_post_item message-tag"
                style={COLLAPSE_ITEM}
                onClick={() => {
                  window.location.href = `${base}/messages`;
                }}
              >
                <i className="fa fa-envelope"></i> {t('messages', { defaultValue: 'Messages' })}
              </p>
            )}
          </div>
        </div>
      </li>
    </>
  );
}

/** blade: the three collapse entries share this inline style. */
const COLLAPSE_ITEM: CSSProperties = {
  margin: 0,
  cursor: 'pointer',
  border: '2px solid #585858',
  marginTop: 10,
  padding: 6,
};

/**
 * Left sidebar (#fh5co-aside) — ported from user_profile.blade.php lines 164-745.
 * Styling comes from the original style.css + extracted layout CSS.
 */
export function ProfileSidebar({
  profile,
  onControlPanel,
  onAddPost,
}: {
  profile: ProfileData;
  onControlPanel?: () => void;
  onAddPost?: () => void;
}) {
  const { t } = useTranslation('nav');
  const { t: tFooter } = useTranslation('footer');
  const { t: tContent } = useTranslation('content');
  const { user: authUser } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Which of the WALL | POSTS tabs is active depends on the route (/:user vs /posts/:user).
  const onPostsTab = pathname.startsWith('/posts/');

  /* Highlight the correct item in the main nav (WALL / POSTS) — only on the viewer's
     OWN wall/posts, mirroring the blade's fh5co-active conditionals. */
  const isOwnProfile = !!authUser && profile.usernameUrl === authUser.usernameUrl;
  let activeNav: 'wall' | 'posts' | undefined;
  if (pathname === '/user/posts' || pathname === '/influencer/posts') activeNav = 'posts';
  else if (pathname === '/user' || pathname === '/influencer') activeNav = 'wall';
  else if (pathname.startsWith('/posts/')) activeNav = isOwnProfile ? 'posts' : undefined;
  else if (isOwnProfile) activeNav = 'wall';

  // Go-Live modal (port of the #streamForm bio/tags modal in the layout footer).
  const [goLiveOpen, setGoLiveOpen] = useState(false);
  const [streamBio, setStreamBio] = useState('');
  const [streamTags, setStreamTags] = useState('');
  const [goLiveBusy, setGoLiveBusy] = useState(false);

  async function submitGoLive(e: React.FormEvent) {
    e.preventDefault();
    if (!streamBio.trim() || !streamTags.trim() || goLiveBusy) return;
    setGoLiveBusy(true);
    try {
      const { data } = await api.post<{ roomName: string }>('/create-room', {
        bio: streamBio.trim(),
        tags: streamTags.trim(),
      });
      if (data.roomName) navigate(`/start-stream/${data.roomName}`);
    } catch {
      setGoLiveBusy(false);
    }
  }

  const usernameUrl = profile.usernameUrl;
  const longUsername = usernameUrl.length > 13;

  const monoFont =
    "Consolas, Menlo, Monaco, 'Lucida Console', 'Liberation Mono', 'DejaVu Sans Mono', 'Bitstream Vera Sans Mono', 'Courier New', monospace, serif";

  const homeHref = authUser ? (authUser.role === 'influencer' ? '/influencer' : '/user') : '/';

  return (
    <aside id="fh5co-aside" role="complementary" className="border js-fullheight">
      <h1 id="fh5co-logo" style={{ marginBottom: 0 }}>
        <a href={homeHref}>
          <img src="/assets/images/SUPERHEROINA.svg" style={{ width: '54%' }} alt="" />
        </a>
      </h1>

      {/* terminal-style @username badge (green dot, dark box) */}
      <p
        className={longUsername ? 'animated_username' : undefined}
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
          overflowX: 'hidden',
          overflowY: 'hidden',
        }}
      >
        <span
          style={{ width: 20, height: 20, background: '#585858', position: 'absolute', zIndex: 2, left: 0 }}
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
        <span style={{ display: 'inline-block' }} className={longUsername ? 'arrow' : 'arrow_small_username'}>
          <span>@</span>
          {usernameUrl}
        </span>
      </p>

      {/* WALL | POSTS tabs */}
      <ul
        style={{
          listStyleType: 'none',
          display: 'flex',
          fontSize: 14,
          justifyContent: 'space-between',
          padding: '0px 26%',
          maxWidth: 300,
          textAlign: 'center',
          marginLeft: 'auto',
          marginRight: 'auto',
          width: '100%',
        }}
      >
        <li>
          <Link
            className={onPostsTab ? undefined : 'fh5co-active'}
            to={`/${usernameUrl}`}
            style={{
              textDecoration: onPostsTab ? 'none' : 'underline',
              textTransform: 'uppercase',
              color: '#222',
              fontSize: '0.83em',
              fontFamily: monoFont,
            }}
          >
            {t('wall', { defaultValue: 'Wall' })}
          </Link>
        </li>
        <li>
          <Link
            className={onPostsTab ? 'fh5co-active' : undefined}
            to={`/posts/${usernameUrl}`}
            style={{
              textDecoration: onPostsTab ? 'underline' : 'none',
              textTransform: 'uppercase',
              color: '#222',
              fontSize: '0.83em',
              fontFamily: monoFont,
            }}
          >
            {t('posts', { defaultValue: 'Posts' })}
          </Link>
        </li>
      </ul>

      <center>
        <nav id="fh5co-main-menu" role="navigation">
          <ul>
            <li style={{ marginBottom: 30 }}>
              <a
                className="streaming_anchor"
                style={{ cursor: 'pointer', marginBottom: 0 }}
                onClick={() => {
                  closeOffcanvas();
                  setGoLiveOpen(true);
                }}
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
              <NetworksSlider networks={profile.networkDetails} />
            </li>

            {authUser ? (
              <>
                <LoggedInNav
                  active={activeNav}
                  showAddPost
                  showMessages
                  onAddPost={onAddPost}
                  onControlPanel={onControlPanel}
                />
              </>
            ) : (
              <li className="login_btn world_after" style={{ marginTop: -5, marginBottom: 26 }}>
                <a href="/world">
                  <b>{t('world', { defaultValue: 'World' })}</b>
                </a>
              </li>
            )}

            <hr style={{ marginTop: -10, marginBottom: 40 }} />

            <li>
              <InfluencerSearch
                placeholder={t('search_influencer', { defaultValue: 'Search influencer' })}
              />
            </li>

            <br />
            <hr style={{ marginTop: -10, marginBottom: 40 }} />
          </ul>
        </nav>

        <div className="fh5co-footer" style={{ position: 'inherit' }}>
          <ul>
            {authUser ? (
              <li className="nav-item mx-2">
                <Link
                  className="btn btn-danger power-btn"
                  style={{
                  }}
                  to="/logout"
                >
                  <i className="fa fa-power-off" aria-hidden="true"></i>
                </Link>
              </li>
            ) : (
              <li className="nav-item mx-2">
                <a
                  className="btn btn-outline power-btn"
                  style={{
                    backgroundColor: '#724BB6',
                    borderColor: '#724BB6',
                    color: 'white',
                  }}
                  href={`/login?username=${usernameUrl}`}
                >
                  <i className="fa fa-power-off" aria-hidden="true"></i>
                </a>
              </li>
            )}
          </ul>
          <br />
          <p>
            <small>
              <span>
                <a
                  href="/super-ads"
                  target="_blank"
                  style={{ color: 'gray' }}
                >
                  🏢: SUPER ADS CENTER
                </a>{' '}
              </span>
              <br />© 2021-2025{' '}
              {profile.footerNameUsername === 'username' ? (
                <>
                  <span style={{ display: 'inline-block' }}>@</span>
                  {usernameUrl}
                </>
              ) : (
                <>
                  {profile.name} {profile.surname ?? ''}
                </>
              )}{' '}
              <br />
              All Rights Reserved.{' '}
              <span>
                {tFooter('powered_by', { defaultValue: 'Powered by' })}{' '}
                <a href="/world">SUPERFANSS.APP</a>
              </span>
            </small>
          </p>

          <FooterLanguageSelector />
        </div>
      </center>

      {/* Go-Live modal — port of #streamingModalCenter (purple, superman header, bio/tags).
          Portaled to <body> like the Laravel footer modal so it escapes the sidebar's
          stacking context and sits above the profile header. POST /create-room → /start-stream/:room. */}
      {goLiveOpen && createPortal(
        <div
          onClick={() => setGoLiveOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 123112311231, overflowY: 'auto' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 600, maxWidth: 'calc(100% - 20px)', margin: '30px auto', position: 'relative' }}
          >
            <div className="modal-content" style={{ borderRadius: 20, background: 'blueviolet' }}>
              <div style={{ border: 0, padding: 15, position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setGoLiveOpen(false)}
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
              <div style={{ border: 0, padding: 15 }}>
                <form onSubmit={submitGoLive}>
                  <div className="form-group" style={{ display: 'flex' }}>
                    <label style={{ color: '#fff', width: 50 }}>{tContent('stream_bio')}:</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      required
                      placeholder={tContent('stream_bio_placeholder')}
                      value={streamBio}
                      onChange={(e) => setStreamBio(e.target.value)}
                      style={{ backgroundColor: '#fff', color: '#000' }}
                    />
                  </div>
                  <div className="form-group mt-3" style={{ display: 'flex', marginTop: 20 }}>
                    <label style={{ color: '#fff', width: 50 }}>{tContent('stream_tags')}:</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      placeholder={tContent('stream_tags_placeholder')}
                      value={streamTags}
                      onChange={(e) => setStreamTags(e.target.value)}
                      style={{ backgroundColor: '#fff', color: '#000' }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
                    <button type="submit" className="btn btn-light" disabled={goLiveBusy} style={{ padding: '10px 20px' }}>
                      🔴 {tContent('stream_start_button')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </aside>
  );
}
