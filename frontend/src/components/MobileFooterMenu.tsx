import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useRegisterModal } from './RegisterModal';
import { assetImage } from '../utils/format';
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
  const navigate = useNavigate();
  /* the blade sent guests to the /login page from here; everywhere else in the
     app a guest action raises the register modal, so these do the same */
  const registerModal = useRegisterModal();
  const [query, setQuery] = useState('');
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

  return (
    <div className={`mobile-footer-menu${authUser ? '' : ' is-guest'}`}>
      <div className="mobile-search-container">
        <input
          type="text"
          className="footer-search-input influencer_search"
          placeholder="🔎Search"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ul className="mobile-suggestions-list" style={{ display: hits.length ? 'block' : 'none' }}>
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
          <div className="footer-btn-square footer-btn-addpost" onClick={onAddPost} style={{ cursor: 'pointer' }}>
            <strong style={{ fontSize: 25 }}>+</strong>
          </div>

          <div className="footer-btn-stream" style={{ cursor: 'pointer' }}>
            <span className="stream-indicator"></span>
            Stream
          </div>

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
          onClick={registerModal.open}
          style={{ borderRadius: 20, cursor: 'pointer' }}
        >
          <b>Login</b> | <i className="fa fa-power-off" aria-hidden="true"></i>
        </div>
      )}
    </div>
  );
}
