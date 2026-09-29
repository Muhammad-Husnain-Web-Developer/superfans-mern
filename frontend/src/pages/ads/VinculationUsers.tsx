import { useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { assetImage } from '../../utils/format';
import { useStandalonePageStyles, BOOTSTRAP4_CDN } from '../../components/StandalonePage';
import { AdsSidebar } from './AdsSidebar';
import { useAuth } from '../../context/AuthContext';

/**
 * Vinculation user — the business account's side of Vinculación Partner.
 *
 * No Laravel original; the screen follows the client's mock of 29 Sep 2026: the search and its
 * Send Solicitude above, then "Vinculated Users: (n/5 Accounts)" listing each linked account by
 * handle and kind, with Administrar on the ones that accepted and Pendent on the ones still
 * waiting. The slots not yet used are drawn as empty rows, because the point of the screen is
 * how many of the five are left. Under it, his VIP line for buying more.
 *
 * Administrar is what an accepted link is *for*: it opens Super Ads Center inside that account
 * (`/super-ads?as=<id>`), where the business can make its ads — including the three the centre
 * otherwise hides from a business, because the account being worked in is a creator or a user.
 *
 * A creator or user opening this page sees the other side of the same link: which businesses
 * are managing them, and a way to end it. The client asked for that to live here — "Yes, they
 * can. In the Super Ads Center. More Tools."
 */

interface Candidate {
  id: string;
  usernameUrl: string;
  profilePicture?: string | null;
}

interface ManagerRow {
  id: string;
  since: string;
  business: {
    id: string;
    usernameUrl: string | null;
    name: string | null;
    profilePicture: string | null;
  };
}

interface LinkRow {
  id: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  user: {
    id: string;
    usernameUrl: string | null;
    name: string | null;
    profilePicture: string | null;
    role: string | null;
  };
}

const AVATAR_FALLBACK = 'output-onlinepngtools (2).png';
const MONO = 'Consolas, "Courier New", monospace';

export function VinculationUsers() {
  useStandalonePageStyles([BOOTSTRAP4_CDN, '/page-css/ads-center.css']);
  const navigate = useNavigate();
  const { user } = useAuth();
  const isBusiness = user?.role === 'business';
  const [managers, setManagers] = useState<ManagerRow[]>([]);

  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Candidate[]>([]);
  const [picked, setPicked] = useState<Candidate | null>(null);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [used, setUsed] = useState(0);
  const [max, setMax] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function load() {
    api
      .get<{ data: { links: LinkRow[]; used: number; max: number } }>('/partner/links')
      .then(({ data }) => {
        setLinks(data.data.links);
        setUsed(data.data.used);
        setMax(data.data.max);
        setError(null);
      })
      .catch((e) => {
        setError(
          isAxiosError(e) && e.response?.status === 403
            ? 'Only business accounts can access this page.'
            : 'Could not load your linked accounts.',
        );
      })
      .finally(() => setLoading(false));
  }

  function loadManagers() {
    api
      .get<{ data: { managers: ManagerRow[] } }>('/partner/managers')
      .then(({ data }) => setManagers(data.data.managers))
      .catch(() => setManagers([]))
      .finally(() => setLoading(false));
  }

  async function unlinkManager(row: ManagerRow) {
    const who = row.business.name ?? row.business.usernameUrl ?? 'this business';
    if (!window.confirm('Remove ' + who + ' from your account?')) return;
    try {
      await api.delete('/partner/managers/' + row.id);
    } catch {
      /* the list is read again either way, so a failure shows as the row staying put */
    }
    loadManagers();
  }

  useEffect(() => {
    document.title = 'Superfans | Vinculation user';
    if (isBusiness) load();
    else loadManagers();
  }, [isBusiness]);

  /* debounced, like the app's other searches — not one request per keystroke */
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = query.trim();
    if (!q || picked) {
      setHits([]);
      return;
    }
    timer.current = setTimeout(() => {
      api
        .get<{ data: Candidate[] }>(`/users/search/influencers?query=${encodeURIComponent(q)}`)
        .then((r) => setHits(r.data.data.slice(0, 8)))
        .catch(() => setHits([]));
    }, 250);
  }, [query, picked]);

  async function send() {
    if (!picked || sending) return;
    setSending(true);
    setNotice(null);
    try {
      await api.post('/partner/links', { targetId: picked.id });
      setNotice(`Solicitude sent to @${picked.usernameUrl}.`);
      setPicked(null);
      setQuery('');
      load();
    } catch (e) {
      setNotice(
        isAxiosError(e)
          ? ((e.response?.data as { message?: string } | undefined)?.message ??
            'Could not send the solicitude.')
          : 'Could not send the solicitude.',
      );
    } finally {
      setSending(false);
    }
  }

  async function remove(row: LinkRow) {
    const what =
      row.status === 'accepted'
        ? `Unlink @${row.user.usernameUrl}?`
        : `Withdraw the request to @${row.user.usernameUrl}?`;
    if (!window.confirm(what)) return;
    try {
      await api.delete(`/partner/links/${row.id}`);
    } catch {
      /* the list is read again either way, so a failure shows as the row staying put */
    }
    load();
  }

  /* declined asks are not links; they do not take a slot and the mock does not show them */
  const live = links.filter((l) => l.status === 'pending' || l.status === 'accepted');
  const emptySlots = Math.max(0, max - live.length);
  const full = used >= max;

  return (
    <>
      <AdsSidebar active="more-tools" />
      <div className="main">
        <h2 className="mb-4">More Tools</h2>

        {!isBusiness ? (
          <div style={{ maxWidth: 680, paddingLeft: 40 }}>
            <h4 style={{ fontFamily: MONO, fontWeight: 700 }}>Businesses managing your account</h4>
            {loading ? (
              <p>Loading...</p>
            ) : managers.length === 0 ? (
              <p style={{ color: '#777' }}>No business is linked to your account.</p>
            ) : (
              <div style={{ marginTop: 14 }}>
                {managers.map((m) => (
                  <div
                    key={m.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}
                  >
                    <img
                      src={assetImage(m.business.profilePicture || AVATAR_FALLBACK)}
                      alt=""
                      width={34}
                      height={34}
                      style={{
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '2px solid #585858',
                      }}
                    />
                    <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700 }}>
                      {m.business.name ?? '@' + (m.business.usernameUrl ?? '-')}
                    </span>
                    <span style={{ color: '#999', fontFamily: MONO }}>
                      · since {new Date(m.since).toLocaleDateString()}
                    </span>
                    <button
                      type="button"
                      onClick={() => void unlinkManager(m)}
                      style={{
                        marginLeft: 'auto',
                        background: '#e0142c',
                        color: '#fff',
                        border: 0,
                        borderRadius: 0,
                        fontFamily: MONO,
                        fontWeight: 700,
                        padding: '8px 22px',
                        cursor: 'pointer',
                      }}
                    >
                      Desvincular
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : error ? (
          <div className="alert alert-warning">{error}</div>
        ) : (
          <div style={{ maxWidth: 680, paddingLeft: 40 }}>
            <h4 style={{ fontFamily: MONO, fontWeight: 700 }}>
              Vinculate a User account:{' '}
              <span style={{ fontWeight: 400, fontSize: '0.78em' }}>(Máx. {max})</span>
            </h4>

            <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start', marginTop: 14 }}>
              <div style={{ position: 'relative', flex: '0 1 380px' }}>
                <input
                  type="text"
                  placeholder="🔍 Search influencer or user"
                  value={picked ? `@${picked.usernameUrl}` : query}
                  onChange={(e) => {
                    setPicked(null);
                    setQuery(e.target.value);
                  }}
                  style={{
                    width: '100%',
                    background: '#d9d9d9',
                    border: '2px solid #585858',
                    borderRadius: 0,
                    height: 46,
                    padding: '0 12px',
                    fontFamily: MONO,
                    fontSize: 17,
                  }}
                />
                {hits.length > 0 && (
                  <ul
                    style={{
                      position: 'absolute',
                      zIndex: 20,
                      left: 0,
                      right: 0,
                      margin: 0,
                      padding: 0,
                      listStyle: 'none',
                      background: '#fff',
                      border: '2px solid #585858',
                      borderTop: 0,
                      maxHeight: 260,
                      overflowY: 'auto',
                    }}
                  >
                    {hits.map((h) => (
                      <li
                        key={h.id}
                        onClick={() => {
                          setPicked(h);
                          setHits([]);
                        }}
                        style={{
                          padding: '8px 10px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <img
                          src={assetImage(h.profilePicture || AVATAR_FALLBACK)}
                          alt=""
                          width={26}
                          height={26}
                          style={{ borderRadius: '50%', objectFit: 'cover' }}
                        />
                        <span>@{h.usernameUrl}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <button
                type="button"
                onClick={() => void send()}
                disabled={!picked || sending || full}
                style={{
                  background: !picked || full ? '#b9a3e8' : '#6b16ff',
                  color: '#fff',
                  border: 0,
                  borderRadius: 0,
                  fontWeight: 700,
                  fontSize: 19,
                  height: 46,
                  padding: '0 22px',
                  cursor: !picked || full ? 'default' : 'pointer',
                }}
              >
                {sending ? 'Sending…' : 'Send Solicitude'}
              </button>
            </div>

            {full && (
              <p style={{ marginTop: 10, color: '#b00' }}>
                All {max} slots are in use. Unlink one to free a slot.
              </p>
            )}
            {notice && <p style={{ marginTop: 10 }}>{notice}</p>}

            <h4 style={{ fontFamily: MONO, fontWeight: 700, marginTop: 40 }}>
              Vinculated Users:{' '}
              <span style={{ fontWeight: 400, fontSize: '0.78em' }}>
                ({live.length}/{max} Accounts)
              </span>
            </h4>

            {loading ? (
              <p>Loading…</p>
            ) : (
              <div style={{ marginTop: 14 }}>
                {live.map((l) => (
                  <div
                    key={l.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}
                  >
                    <img
                      src={assetImage(l.user.profilePicture || AVATAR_FALLBACK)}
                      alt=""
                      width={34}
                      height={34}
                      style={{
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '2px solid #585858',
                        opacity: l.status === 'pending' ? 0.45 : 1,
                      }}
                    />
                    <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700 }}>
                      @{l.user.usernameUrl ?? '—'}
                    </span>
                    <span style={{ color: '#999', fontFamily: MONO }}>
                      · {l.user.role === 'influencer' ? 'Creator account' : 'User account'}
                    </span>

                    <button
                      type="button"
                      title={
                        l.status === 'accepted'
                          ? `Work inside @${l.user.usernameUrl}`
                          : 'Waiting for this account to answer.'
                      }
                      onClick={() =>
                        l.status === 'accepted' && navigate(`/super-ads?as=${l.user.id}`)
                      }
                      style={{
                        marginLeft: 'auto',
                        background: l.status === 'accepted' ? '#111' : '#d3d3d3',
                        color: l.status === 'accepted' ? '#fff' : '#555',
                        border: 0,
                        borderRadius: 0,
                        fontFamily: MONO,
                        fontWeight: 700,
                        fontSize: 16,
                        padding: '8px 22px',
                        cursor: l.status === 'accepted' ? 'pointer' : 'default',
                      }}
                    >
                      {l.status === 'accepted' ? 'Administrar' : 'Pendent'}
                    </button>

                    {/* the unlink the client confirmed he wants; kept small so it does not
                        compete with the button his mock draws */}
                    <button
                      type="button"
                      onClick={() => void remove(l)}
                      title={l.status === 'accepted' ? 'Unlink' : 'Withdraw'}
                      style={{
                        background: 'none',
                        border: 0,
                        color: '#b00',
                        fontSize: 19,
                        lineHeight: 1,
                        cursor: 'pointer',
                        padding: '0 4px',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}

                {/* the slots still free, drawn as the mock draws them */}
                {Array.from({ length: emptySlots }).map((_, i) => (
                  <div
                    key={`slot-${i}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}
                  >
                    <span
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: '50%',
                        background: '#e6e6e6',
                        border: '2px solid #d3d3d3',
                        display: 'inline-block',
                      }}
                    />
                    <span style={{ display: 'flex', gap: 8 }}>
                      {Array.from({ length: 9 }).map((__, k) => (
                        <span
                          key={k}
                          style={{ width: 34, height: 9, background: '#e6e6e6', display: 'inline-block' }}
                        />
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <p style={{ marginTop: 26, fontFamily: MONO, fontWeight: 700 }}>
              Sign up VIP Business for more Vinculations{' '}
              <button
                type="button"
                onClick={() => window.alert('VIP Business is not built yet.')}
                style={{
                  marginLeft: 14,
                  background: '#ffd400',
                  color: '#222',
                  border: '2px solid #c9a600',
                  borderRadius: 0,
                  fontWeight: 700,
                  padding: '5px 14px',
                  cursor: 'pointer',
                }}
              >
                Upgrade VIP
              </button>
            </p>
          </div>
        )}
      </div>
    </>
  );
}
