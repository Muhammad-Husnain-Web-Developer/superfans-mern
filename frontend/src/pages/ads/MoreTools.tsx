import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStandalonePageStyles, BOOTSTRAP4_CDN } from '../../components/StandalonePage';
import { AdsSidebar } from './AdsSidebar';
import { useAuth } from '../../context/AuthContext';

/**
 * More Tools — the three buttons of the client's mock (29 Sep 2026).
 *
 * Only the first leads anywhere so far. Automate AI and VIP Business are drawn because he drew
 * them, and each is its own piece of work he has not specified yet; they say so when pressed
 * rather than pretending to be finished.
 */
export function MoreTools() {
  useStandalonePageStyles([BOOTSTRAP4_CDN, '/page-css/ads-center.css']);
  const navigate = useNavigate();
  const { user } = useAuth();
  /* Automate AI and VIP Business are the business account's own tools; a creator opening
     this page is here for the link it has with a business, and nothing else applies. */
  const isBusiness = user?.role === 'business';

  useEffect(() => {
    document.title = 'Superfans | More Tools';
  }, []);

  /* the chunky monospace buttons the Ads Center is drawn in, square and outlined */
  const base: React.CSSProperties = {
    fontFamily: 'Consolas, "Courier New", monospace',
    fontWeight: 700,
    fontSize: 22,
    padding: '14px 26px',
    borderRadius: 0,
    cursor: 'pointer',
  };

  return (
    <>
      <AdsSidebar active="more-tools" />
      <div className="main">
        <h2 className="mb-4">More Tools</h2>

        <div style={{ display: 'flex', gap: 30, flexWrap: 'wrap', marginTop: 10 }}>
          <button
            type="button"
            style={{ ...base, background: '#6b16ff', color: '#fff', border: '3px solid #2d0b6b' }}
            onClick={() => navigate('/super-ads/more-tools/vinculation')}
          >
            Vinculation user
          </button>

          {isBusiness && (
            <>
              <button
                type="button"
                style={{ ...base, background: '#b3b3b3', color: '#222', border: '3px solid #585858' }}
                onClick={() => window.alert('Automate AI is not built yet.')}
              >
                Automate AI
              </button>

              <button
                type="button"
                style={{ ...base, background: '#ffd400', color: '#222', border: '3px solid #222' }}
                onClick={() => window.alert('VIP Business is not built yet.')}
              >
                VIP Business
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
