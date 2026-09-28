import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useRegisterModal } from './RegisterModal';
import { assetImage } from '../utils/format';
import { AddPostHost } from '../pages/profile/AddPostHost';
import { StreamModal } from './StreamModal';
import { NotificationsBell } from './NotificationsBell';
import '../styles/footer-modals.css';

interface SearchHit {
  name: string;
  verified: boolean;
}

/**
 * Mobile bottom bar — exact port of .mobile-footer-menu from
 * layouts_direct_user/footer.blade.php: search input, 🌎 World, 🏆 Rankings,
 * + add-post (guests → login), Stream, ✉️ messages.
 * Styling comes from the extracted footer-modals.css (shown ≤ its media query).
 */
export function MobileFooterMenu({ onAddPost }: { onAddPost?: () => void }) {
  const { user: authUser } = useAuth();
  const { t: tUi } = useTranslation('ui');
  const { t: tAuth } = useTranslation('auth');
  /* The blade hangs #add_post_modal and #streamingModalCenter off the layout
     footer, so both buttons work on every page that shows this bar. Here they
     were left to each page to provide, and only the profile ever did — which is
     why the client found them dead on World and everywhere else. The bar now
     carries them itself. A page that already owns an add-post dialog still
     passes onAddPost and keeps using its own. */
  const [addPostOpen, setAddPostOpen] = useState(false);
  const [streamOpen, setStreamOpen] = useState(false);
  const navigate = useNavigate();
  /* the blade sent guests to the /login page from here; everywhere else in the
     app a guest action raises the register modal, so these do the same */
  const registerModal = useRegisterModal();
  const [query, setQuery] = useState('');
  /* Only the search field expanding should collapse the bar. :focus-within fired
     for any focused child, so tapping 🌎 or 🏆 opened the search instead of
     following the link. */
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = query.trim();
    if (!q) {
      setHits([]);
      return;
    }
    timer.current = setTimeout(() => {
      api
        .get<{ success: boolean; data: SearchHit[] }>(`/users/search/influencers?query=${encodeURIComponent(q)}`)
        .then((r) => setHits(r.data.data.slice(0, 8)))
        .catch(() => setHits([]));
    }, 200);
  }, [query]);
  /**
   * The ✕ inside the search field — the client asked for the same control the
   * sidebar carries. Clears what was typed and drops the suggestions, so the
   * next tap starts fresh.
   */
  function clearSearch() {
    if (timer.current) clearTimeout(timer.current);
    setQuery('');
    setHits([]);
    /* Same effect as an outside click: the bar's is-searching state is what
       expands the field and hides the other buttons, and collapsing it is what
       "close" means on this bar. Without this, the ✕ cleared the text but left
       the bar wide open — which is what the client noticed. */
    setSearching(false);
  }

  /**
   * Clicking anywhere outside the search container clears the field, same rule
   * the sidebar follows — a half-typed name is a passing act and leaving it
   * behind in the bar is what the client reported.
   *
   * The listener is attached once and reads the current ref, so the query state
   * does not have to be a dependency of the effect.
   */
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const clearRef = useRef(clearSearch);
  clearRef.current = clearSearch;
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!searchBoxRef.current || searchBoxRef.current.contains(e.target as Node)) return;
      clearRef.current();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);
  return (
    <div className={`mobile-footer-menu${authUser ? '' : ' is-guest'}${searching ? ' is-searching' : ''}`}>
      <div className="mobile-search-container" ref={searchBoxRef}>
        {/* The ✕ is positioned against this wrapper, not the container: below 768px the
            container is deliberately position:static so the suggestions list can resolve
            against the fixed bar and span its full width. Without the wrapper the ✕
            anchored to the bar too, and sat outside the field's right edge. */}
        <span className="mobile-search-field">
          <input
            type="text"
            className="footer-search-input influencer_search"
            placeholder={tUi('search_placeholder')}
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setSearching(true)}
            onBlur={() => setSearching(false)}
            /* reserve room for the ✕ whenever it shows, so a long query does not run
               underneath it */
            style={searching || query ? { paddingRight: 26 } : undefined}
          />
          {/* The client asked for the ✕ from the moment the field is entered, not from the
              first character typed — so it is there to close the search straight away.
              Tapping it on an empty field blurs the input first, which unmounts the button
              before its click lands; that costs nothing, because blur collapses the bar and
              that is all clearSearch would have done with nothing typed. With text present
              the query keeps the button mounted through the blur, so the click still runs. */}
          {(searching || query) && (
            <button
              type="button"
              className="mobile-search-clear"
              /* No preventDefault: the input's own onBlur collapses the bar, and
                 that is exactly the behaviour the client wants on the ✕ — the same
                 as tapping outside. clearSearch also sets searching=false, so the
                 two paths arrive at the same state even if the order differs. */
              onClick={(e) => {
                e.stopPropagation();
                clearSearch();
              }}
              aria-label={tUi('close')}
            >
              ✕
            </button>
          )}
        </span>
        <ul className="mobile-suggestions-list" style={{ display: hits.length ? 'flex' : 'none' }}>
          {hits.map((h) => (
            <li
              key={h.name}
              onClick={() => {
                setQuery('');
                setHits([]);
                navigate(`/${h.name}`);
              }}
              style={{ cursor: 'pointer', padding: '6px 10px' }}
            >
              {h.name}
              {h.verified && (
                <img
                  src={assetImage('verified.png')}
                  alt=""
                  width={14}
                  height={14}
                  style={{ marginLeft: 4, display: 'inline-block' }}
                />
              )}
            </li>
          ))}
        </ul>
      </div>

      <a href="/world" className="footer-btn-square footer-btn-world">
        🌎
      </a>

      <a href="/rankings" className="footer-btn-square footer-btn-rankings text-center">
        🏆
      </a>

      {authUser ? (
        <>
          <div
            className="footer-btn-square footer-btn-addpost"
            onClick={onAddPost ?? (() => setAddPostOpen(true))}
            style={{ cursor: 'pointer' }}
          >
            <strong style={{ fontSize: 25 }}>+</strong>
          </div>

          {/* Icon only, as the client's own bar is drawn: the red dot alone, no wording. The
              label it used to print is kept as the accessible name so nothing is lost to a
              reader that cannot see the dot. */}
          <div
            className="footer-btn-stream"
            onClick={() => setStreamOpen(true)}
            style={{ cursor: 'pointer' }}
            role="button"
            aria-label={tUi('nav_stream')}
            title={tUi('nav_stream')}
          >
            <span className="stream-indicator"></span>
          </div>

          {/* the client's bell sits between the stream button and the inbox, as in his
              own capture of the bar */}
          <NotificationsBell />

          <a href="/user/messages" className="footer-btn-message">
            <i className="fa fa-envelope"></i>
          </a>
        </>
      ) : (
        /* Add post, Stream and Mensajes all need an account, and the blade sent
           guests from each of them to /login. One Login button replaces the three.
           It carries .login-btn-top — the very control from the top-right corner,
           same rounded purple and same bold Roboto — because only its position
           moved. .footer-btn-login just lets the bar collapse it with the rest. */
        <div
          className="btn login-btn-top footer-btn-login"
          onClick={registerModal.openLogin}
          style={{ borderRadius: 20, cursor: 'pointer' }}
        >
          <b>{tAuth('Login_btn')}</b> | <i className="fa fa-power-off" aria-hidden="true"></i>
        </div>
      )}

      {!onAddPost && <AddPostHost open={addPostOpen} onClose={() => setAddPostOpen(false)} />}
      <StreamModal open={streamOpen} onClose={() => setStreamOpen(false)} />
    </div>
  );
}
