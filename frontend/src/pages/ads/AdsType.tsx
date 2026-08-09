import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { api } from '../../api/client';
import { assetImage, isVideoFile, videoMime } from '../../utils/format';
import { useStandalonePageStyles, BOOTSTRAP4_CDN } from '../../components/StandalonePage';

interface Campaign {
  id: string;
  title: string;
  type: string;
  status: string;
  media: string | null;
  budget: number;
  campaignDays: number | null;
  approved: number;
  createdAt: string;
}

const ucfirst = (t: string) => t.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Per-type input(s) the backend buildAd() expects, beyond the common ad_name + amount. */
const TYPE_FIELDS: Record<string, { key: string; label: string; placeholder: string; type?: string }[]> = {
  instagram: [{ key: 'instagram_url', label: 'Instagram username', placeholder: 'username' }],
  tiktok: [{ key: 'tiktok_username', label: 'TikTok username', placeholder: '@username' }],
  twitch: [{ key: 'twitch_username', label: 'Twitch username', placeholder: 'username' }],
  amazon: [{ key: 'amazon_url', label: 'Amazon URL', placeholder: 'https://amazon…', type: 'url' }],
  spotify: [{ key: 'spotify_url', label: 'Spotify URL', placeholder: 'https://spotify…', type: 'url' }],
  'website-visits': [{ key: 'website_url', label: 'Website URL', placeholder: 'https://…', type: 'url' }],
  youtube: [{ key: 'youtube_url', label: 'YouTube URL', placeholder: 'https://youtube…', type: 'url' }],
  whatsapp: [{ key: 'whatsapp_number', label: 'WhatsApp number', placeholder: '+34…' }],
  calls: [{ key: 'phone', label: 'Phone number', placeholder: '+34…' }],
};
/** Types that pick one of your Superfans posts (post_id) instead of a URL. */
const POST_TYPES = new Set(['promote-post', 'messages', 'profile-followers']);

interface PostThumb { id: string; imageVideo: string | null }

/** Manage {type} Ads — port of ads/type.blade.php (standalone page, no sidebar): a
 * "Back to Ads Dashboard" bar, the "Add New {Type} Ad" toggle, and the campaigns table
 * with Stop/Play + Delete per row. */
export function AdsType() {
  useStandalonePageStyles([BOOTSTRAP4_CDN, '/page-css/ads-center.css']);
  const { type = '' } = useParams();
  const [ads, setAds] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [adName, setAdName] = useState('');
  const [amount, setAmount] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [postId, setPostId] = useState('');
  const [posts, setPosts] = useState<PostThumb[]>([]);
  const [busy, setBusy] = useState(false);

  const isPostType = POST_TYPES.has(type);
  const typeFields = TYPE_FIELDS[type] ?? [];

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<{ ads: Campaign[] }>(`/ads/type/${type}`)
      .then(({ data }) => setAds(data.ads))
      .catch((e) => { if (isAxiosError(e) && e.response?.status === 403) setDenied(true); })
      .finally(() => setLoading(false));
  }, [type]);

  useEffect(() => {
    document.title = `Superfans | ${ucfirst(type)} Ads`;
    load();
  }, [type, load]);

  // load the advertiser's posts for the post-picker types when the form opens
  useEffect(() => {
    if (addOpen && isPostType && posts.length === 0) {
      api.get<{ posts: PostThumb[] }>('/ads/posts').then(({ data }) => setPosts(data.posts)).catch(() => undefined);
    }
  }, [addOpen, isPostType, posts.length]);

  function toggleStatus(id: string) {
    api.put(`/ads/campaign/${id}/toggle`).then(load).catch(() => undefined);
  }

  function remove(id: string) {
    if (!window.confirm('Delete this ad?')) return;
    api.delete(`/ads/campaign/${id}`).then(load).catch(() => undefined);
  }

  function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    api
      .post<{ message?: string }>(`/ads/store/${type}`, {
        ad_name: adName || undefined,
        amount: amount ? Number(amount) : undefined,
        ...(isPostType ? { post_id: postId } : {}),
        ...fields,
      })
      .then(({ data }) => {
        setFlash(data.message ?? 'Ad added successfully');
        setAdName(''); setAmount(''); setFields({}); setPostId('');
        setAddOpen(false);
        load();
      })
      .finally(() => setBusy(false));
  }

  return (
    <>
      {/* Top bar (no sidebar on the type page) */}
      <div className="bg-white border-bottom py-2 px-3 d-flex align-items-center shadow-sm">
        <a href="/super-ads" className="d-flex align-items-center text-decoration-none">
          <img src="/assets/images/Superworld-13.svg" alt="Superfans" height={35} className="mr-2" />
          <span className="font-weight-bold text-dark">Back to Ads Dashboard</span>
        </a>
      </div>

      <div className="container mt-4">
        {denied ? (
          <div className="text-center" style={{ padding: '10vh 0' }}>
            <h1 style={{ fontSize: '3em', fontWeight: 700 }}>403</h1>
            <p>Access denied.</p>
          </div>
        ) : (
        <>
        <h2 className="mb-4">Manage {ucfirst(type)} Ads</h2>

        {flash && (
          <div className="greenlabel">
            <h2>✔</h2>
            <p>{flash}</p>
          </div>
        )}

        {/* Add New Ad toggle */}
        <button className="btn btn-primary mb-3" onClick={() => setAddOpen((v) => !v)}>
          Add New {ucfirst(type)} Ad
        </button>

        {addOpen && (
          <div className="card p-3 mb-4">
            <form onSubmit={submitAdd}>
              {/* post-picker types: choose one of your Superfans posts */}
              {isPostType ? (
                <div className="form-group">
                  <label>Select one of your posts</label>
                  <div className="row" style={{ maxHeight: 320, overflowY: 'auto' }}>
                    {posts.map((p) => (
                      <div className="col-4 mb-3" key={p.id}>
                        <div
                          className="card"
                          onClick={() => setPostId(p.id)}
                          style={{ cursor: 'pointer', border: postId === p.id ? '3px solid #007bff' : undefined }}
                        >
                          {p.imageVideo && isVideoFile(p.imageVideo) ? (
                            <video className="card-img-top" muted><source src={assetImage(p.imageVideo)} type={videoMime(p.imageVideo)} /></video>
                          ) : (
                            <img className="card-img-top" src={p.imageVideo ? assetImage(p.imageVideo) : assetImage('blue24.png')} alt="" />
                          )}
                          <div className="card-body p-2 text-center"><small>#{p.id.slice(-6)}</small></div>
                        </div>
                      </div>
                    ))}
                    {posts.length === 0 && <p className="text-muted px-3">No posts available.</p>}
                  </div>
                </div>
              ) : (
                typeFields.map((f) => (
                  <div className="form-group" key={f.key}>
                    <label>{f.label}</label>
                    <input
                      className="form-control"
                      type={f.type ?? 'text'}
                      placeholder={f.placeholder}
                      value={fields[f.key] ?? ''}
                      onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })}
                    />
                  </div>
                ))
              )}

              <div className="form-group">
                <label>Ad Title</label>
                <input className="form-control" value={adName} onChange={(e) => setAdName(e.target.value)} placeholder="Untitled Ad" />
              </div>
              <div className="form-group">
                <label>Budget (€)</label>
                <input className="form-control" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-success" disabled={busy || (isPostType && !postId)}>Submit</button>
            </form>
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table className="table table-bordered table-striped">
            <thead className="thead-dark">
              <tr><th>ID</th><th>Preview</th><th>Type</th><th>Status</th><th>Created</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center">Loading…</td></tr>
              ) : ads.length === 0 ? (
                <tr><td colSpan={6} className="text-center">No ads found.</td></tr>
              ) : (
                ads.map((ad) => (
                  <tr key={ad.id}>
                    <td>{ad.id.slice(-6)}</td>
                    <td>
                      {ad.media ? (
                        isVideoFile(ad.media) ? (
                          <video width={110} muted><source src={assetImage(ad.media)} type={videoMime(ad.media)} /></video>
                        ) : (
                          <img src={assetImage(ad.media)} alt="" width={110} />
                        )
                      ) : ad.type === 'instagram' ? 'No Instagram link' : '—'}
                    </td>
                    <td>{ad.type}</td>
                    <td>
                      <span className={`badge badge-${ad.status === 'active' ? 'success' : 'secondary'}`}>
                        {ad.status === 'active' ? 'Running' : 'Stopped'}
                      </span>
                    </td>
                    <td>{new Date(ad.createdAt).toLocaleString()}</td>
                    <td>
                      <button className="btn btn-sm btn-warning mr-1" onClick={() => toggleStatus(ad.id)}>
                        {ad.status === 'active' ? 'Stop' : 'Play'}
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => remove(ad.id)}>Delete</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        </>
        )}
      </div>
    </>
  );
}
