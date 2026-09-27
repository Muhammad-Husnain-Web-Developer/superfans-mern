import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStandalonePageStyles, BOOTSTRAP4_CDN } from '../../components/StandalonePage';
import { AdsSidebar } from './AdsSidebar';
import { useAuth } from '../../context/AuthContext';

/**
 * More Tools — the three buttons of the client's mock (29 Sep 2026).
 *
 * Automate AI is a dialog and nothing more, which is all he asked for (29 Sep 2026): an
 * account without VIP is pointed at buying it, one that already has it is told to contact
 * support. VIP Business opens its own privileges page.
 */
export function MoreTools() {
  useStandalonePageStyles([BOOTSTRAP4_CDN, '/page-css/ads-center.css']);
  const navigate = useNavigate();
  const { user } = useAuth();
  /* Automate AI and VIP Business are the business account's own tools; a creator opening
     this page is here for the link it has with a business, and nothing else applies. */
  const isBusiness = user?.role === 'business';
  const [automate, setAutomate] = useState(false);

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
                onClick={() => setAutomate(true)}
              >
                Automate AI
              </button>

              <button
                type="button"
                style={{ ...base, background: '#ffd400', color: '#222', border: '3px solid #222' }}
                onClick={() => navigate('/super-ads/more-tools/vip')}
              >
                VIP Business
              </button>
            </>
          )}
        </div>

        {automate && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              zIndex: 999999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={() => setAutomate(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#fff',
                border: '3px solid #585858',
                padding: 28,
                width: 470,
                maxWidth: '92%',
                fontFamily: 'Consolas, "Courier New", monospace',
                textAlign: 'center',
              }}
            >
              <h4 style={{ fontWeight: 700, marginTop: 0 }}>🤖 Automate AI</h4>
              {user?.vip ? (
                <p style={{ marginTop: 18, marginBottom: 24 }}>
                  Contact support to manage Automatization AI.
                </p>
              ) : (
                <p style={{ marginTop: 18, marginBottom: 24 }}>
                  Automate AI is only available with a VIP Business account.
                </p>
              )}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                {!user?.vip && (
                  <button
                    type="button"
                    onClick={() => navigate('/super-ads/more-tools/vip')}
                    style={{
                      background: '#ffd400',
                      color: '#222',
                      border: '3px solid #222',
                      borderRadius: 0,
                      fontWeight: 700,
                      padding: '8px 18px',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Get VIP Business
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setAutomate(false)}
                  style={{
                    background: '#d3d3d3',
                    color: '#222',
                    border: '3px solid #585858',
                    borderRadius: 0,
                    fontWeight: 700,
                    padding: '8px 18px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
