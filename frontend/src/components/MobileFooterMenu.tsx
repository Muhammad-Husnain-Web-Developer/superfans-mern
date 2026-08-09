import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
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
    <div className="mobile-footer-menu">
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
        <div className="footer-btn-square footer-btn-addpost" onClick={onAddPost} style={{ cursor: 'pointer' }}>
          <strong style={{ fontSize: 25 }}>+</strong>
        </div>
      ) : (
        <a href="/login" className="footer-btn-square footer-btn-addpost">
          <strong style={{ fontSize: 25 }}>+</strong>
        </a>
      )}

      {authUser ? (
        <div className="footer-btn-stream" style={{ cursor: 'pointer' }}>
          <span className="stream-indicator"></span>
          Stream
        </div>
      ) : (
        <a href="/login" className="footer-btn-stream">
          <span className="stream-indicator"></span>
          Stream
        </a>
      )}

      <a href="/user/messages" className="footer-btn-message">
        <i className="fa fa-envelope"></i>
      </a>
    </div>
  );
}
