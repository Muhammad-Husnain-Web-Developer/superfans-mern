import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useStandalonePageStyles, BOOTSTRAP4_CDN } from '../../components/StandalonePage';
import { AdsSidebar } from './AdsSidebar';

/**
 * VIP Business Account — the privileges page from the client's mock of 29 Sep 2026.
 *
 * The list is his, line for line, including the figures he gave in writing: 250 vinculation
 * accounts and a price of 2.500€.
 *
 * Buying it goes the way VIP already goes in this app: the request reaches the ads admin by
 * mail (`/ads/vip-request`, the same call Super Video's dialog makes) and the admin turns on
 * the account's `vip` flag. There is no card form here because the client named a price but
 * not how it is collected, and inventing a checkout for 2.500€ is not a detail to guess at.
 */

const MONO = 'Consolas, "Courier New", monospace';

/** Each line of his list: an emoji, the part in bold, and the rest. */
const PRIVILEGES: { icon: string; strong: string; rest: string }[] = [
  { icon: '🪄🎬', strong: 'Super Video', rest: 'Reproduce a full screen video.' },
  { icon: '', strong: '250', rest: 'Vinculation accounts' },
  { icon: '📖', strong: 'Locations', rest: '· All countries unblocked for do Ads' },
  {
    icon: '',
    strong: '',
    rest: '· All countries unblocked for post content on WORLD algorythm (Choose 5 countries +15% Possibility of Vision)',
  },
  { icon: '📈', strong: '+25%', rest: 'Possibilitat Visió' },
  { icon: '💲', strong: '92%', rest: 'Benefits of Subscriptions' },
  {
    icon: '💰',
    strong: 'Ads Earnings',
    rest: 'active: Banners and in-Video (There are no established CPM figures)',
  },
  { icon: '✂️', strong: '-10%', rest: 'Lower price for all Ads' },
  { icon: '📊', strong: '+5%', rest: 'More audience' },
];

export function VipBusiness() {
  useStandalonePageStyles([BOOTSTRAP4_CDN, '/page-css/ads-center.css']);
  const { user } = useAuth();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Superfans | VIP Business';
  }, []);

  async function request() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.post('/ads/vip-request');
      setSent(true);
    } catch {
      setError('Could not send the request. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const alreadyVip = !!user?.vip;

  return (
    <>
      <AdsSidebar active="more-tools" />
      <div className="main">
        <h2 className="mb-4">More Tools</h2>

        <div style={{ maxWidth: 820, paddingLeft: 20 }}>
          <h3 style={{ fontFamily: MONO, fontWeight: 700 }}>⭐ VIP Business Account</h3>
          <p style={{ fontSize: 19, marginTop: 18 }}>What privileges I will get?</p>

          <div style={{ marginTop: 18, lineHeight: 2.1, fontSize: 16 }}>
            {PRIVILEGES.map((p, i) => (
              <div key={i} style={{ paddingLeft: p.icon ? 0 : 34 }}>
                {p.icon && <span style={{ marginRight: 8 }}>{p.icon}</span>}
                {p.strong && <b>{p.strong} </b>}
                <span style={{ color: '#555' }}>{p.rest}</span>
              </div>
            ))}
          </div>

          <p style={{ marginTop: 26, fontFamily: MONO, fontWeight: 700, fontSize: 18 }}>
            Price: 2.500€
          </p>

          {alreadyVip ? (
            <p style={{ marginTop: 18, fontWeight: 700 }}>
              ⭐ This account is already VIP Business.
            </p>
          ) : sent ? (
            <p style={{ marginTop: 18, fontWeight: 700 }}>
              Request sent. Our team will contact you to complete it.
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void request()}
                disabled={busy}
                style={{
                  marginTop: 18,
                  background: '#00e05a',
                  color: '#111',
                  border: '3px solid #111',
                  borderRadius: 0,
                  fontFamily: MONO,
                  fontWeight: 700,
                  fontSize: 17,
                  padding: '10px 22px',
                  cursor: busy ? 'default' : 'pointer',
                }}
              >
                {busy ? 'Sending…' : 'Get VIP Business account'}
              </button>
              {error && <p style={{ color: '#b00', marginTop: 12 }}>{error}</p>}
            </>
          )}
        </div>
      </div>
    </>
  );
}
