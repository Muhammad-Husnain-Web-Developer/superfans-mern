import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { DataTableShell } from './DataTableShell';
import { assetImage, isVideoFile, videoMime } from '../../utils/format';
import { LOCKED_POST_IMAGE } from '../../utils/networkLogo';
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

interface TypeField {
  key: string;
  label: string;
  placeholder: string;
  type?: string;
  area?: boolean;
}

/**
 * The fields each type asks for, taken from the blade's own branches
 * (resources/views/ads/type.blade.php): clients-form title + budget, messages title + link,
 * instagram link, calls phone, whatsapp phone + message, website-visits link — every one of
 * them but instagram also uploading a creative.
 *
 * The social types below (tiktok, twitch, amazon, spotify, youtube) have no branch in the
 * blade at all, so its form offers them nothing and the ad cannot be built. Their fields are
 * kept because the link has to come from somewhere; removing them would leave those five
 * cards leading to a form that cannot produce an ad.
 */
const TYPE_FIELDS: Record<string, TypeField[]> = {
  'clients-form': [{ key: 'title', label: 'Ad Title', placeholder: 'Get More Clients' }],
  messages: [
    { key: 'title', label: 'Ad Title', placeholder: 'Chat with us!' },
    { key: 'link', label: 'Message Link (Messenger / Inbox)', placeholder: 'https://...', type: 'url' },
  ],
  instagram: [
    { key: 'link', label: 'Instagram Post Link', placeholder: 'https://instagram.com/p/...', type: 'url' },
  ],
  calls: [{ key: 'phone', label: 'Phone Number', placeholder: '+1234567890', type: 'tel' }],
  whatsapp: [
    { key: 'phone', label: 'WhatsApp Number', placeholder: '+1234567890', type: 'tel' },
    {
      key: 'whatsapp_message',
      label: 'Message',
      placeholder: 'Type the message people will see when they click the ad',
      area: true,
    },
  ],
  'website-visits': [{ key: 'link', label: 'Website URL', placeholder: 'https://example.com', type: 'url' }],
  tiktok: [{ key: 'tiktok_username', label: 'TikTok username', placeholder: '@username' }],
  twitch: [{ key: 'twitch_username', label: 'Twitch username', placeholder: 'username' }],
  amazon: [{ key: 'amazon_url', label: 'Amazon URL', placeholder: 'https://amazon…', type: 'url' }],
  spotify: [{ key: 'spotify_url', label: 'Spotify URL', placeholder: 'https://spotify…', type: 'url' }],
  youtube: [{ key: 'youtube_url', label: 'YouTube URL', placeholder: 'https://youtube…', type: 'url' }],
};

/** Only promote-post picks one of your own posts; the blade has no picker for anything else. */
const POST_TYPES = new Set(['promote-post']);

/** The types whose blade branch uploads a creative. instagram deliberately stores only a link. */
const MEDIA_TYPES = new Set(['clients-form', 'messages', 'calls', 'whatsapp', 'website-visits']);
/** Of those, the ones whose file input the blade marks required. */
const MEDIA_REQUIRED = new Set(['clients-form', 'messages', 'whatsapp']);

interface PostThumb { id: string; imageVideo: string | null }

/** Manage {type} Ads — port of ads/type.blade.php (standalone page, no sidebar): a
 * "Back to Ads Dashboard" bar, the "Add New {Type} Ad" toggle, and the campaigns table
 * with Stop/Play + Delete per row. */
export function AdsType() {
  /* a business working inside a linked account passes its id along (Vinculacion Partner) */
  const [params] = useSearchParams();
  const as = params.get('as');
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

  const [media, setMedia] = useState<{ name: string; dataUrl: string } | null>(null);

  const isPostType = POST_TYPES.has(type);
  const wantsMedia = MEDIA_TYPES.has(type);
  const typeFields = TYPE_FIELDS[type] ?? [];

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<{ ads: Campaign[] }>(`/ads/type/${type}${as ? `?as=${encodeURIComponent(as)}` : ''}`)
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
      api.get<{ posts: PostThumb[] }>(`/ads/posts${as ? `?as=${encodeURIComponent(as)}` : ''}`).then(({ data }) => setPosts(data.posts)).catch(() => undefined);
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
        /* the creative travels as a data URL, which is what the ad builder reads */
        ...(media ? { media: media.dataUrl } : {}),
        /* and the account it is being made for, when a business is working inside a linked
           one — without this the ad would be stored under the business instead */
        ...(as ? { onBehalfOf: as } : {}),
      })
      .then(({ data }) => {
        setFlash(data.message ?? 'Ad added successfully');
        setAdName(''); setAmount(''); setFields({}); setPostId(''); setMedia(null);
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
                            <img className="card-img-top" src={p.imageVideo ? assetImage(p.imageVideo) : LOCKED_POST_IMAGE} alt="" />
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
                    {f.area ? (
                      <textarea
                        className="form-control"
                        placeholder={f.placeholder}
                        value={fields[f.key] ?? ''}
                        onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })}
                      />
                    ) : (
                      <input
                        className="form-control"
                        type={f.type ?? 'text'}
                        placeholder={f.placeholder}
                        value={fields[f.key] ?? ''}
                        onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })}
                      />
                    )}
                  </div>
                ))
              )}

              {/* The creative itself. The blade takes it as a file; it travels here as a
                  data URL, which is the shape the ad builder already accepts. */}
              {wantsMedia && (
                <div className="form-group">
                  <label>Media</label>
                  <input
                    className="form-control"
                    type="file"
                    accept="image/jpeg,image/png,image/jpg,video/mp4,video/webm"
                    required={MEDIA_REQUIRED.has(type)}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) {
                        setMedia(null);
                        return;
                      }
                      /* the blade caps this at 10 MB */
                      if (file.size > 10 * 1024 * 1024) {
                        setFlash('That file is over 10 MB.');
                        e.target.value = '';
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => setMedia({ name: file.name, dataUrl: String(reader.result) });
                      reader.readAsDataURL(file);
                    }}
                  />
                  {media && <small className="text-muted">{media.name}</small>}
                </div>
              )}

              {/* clients-form and messages carry their own Ad Title in the branch above, the
                  way the blade writes them; the rest get this one so the ad has a name */}
              {!typeFields.some((f) => f.key === 'title') && (
                <div className="form-group">
                  <label>Ad Title</label>
                  <input className="form-control" value={adName} onChange={(e) => setAdName(e.target.value)} placeholder="Untitled Ad" />
                </div>
              )}
              <div className="form-group">
                <label>Budget</label>
                <input className="form-control" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-success" disabled={busy || (isPostType && !postId)}>Upload</button>
            </form>
          </div>
        )}

        {/* the blade wraps this table in DataTables: Show N entries, Search, and the
            "Showing 1 to N of N entries" pager */}
        <DataTableShell
          rows={ads}
          searchText={(ad) => `${ad.id} ${ad.type} ${ad.status === 'active' ? 'running' : 'stopped'}`}
        >
          {(pageRows) => (
          <div style={{ overflowX: 'auto' }}>
            <table className="table table-bordered table-striped">
            <thead className="thead-dark">
              <tr><th>ID</th><th>Preview</th><th>Type</th><th>Status</th><th>Created</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center">Loading…</td></tr>
              ) : pageRows.length === 0 ? (
                <tr><td colSpan={6} className="text-center">No ads found.</td></tr>
              ) : (
                pageRows.map((ad) => (
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
          )}
        </DataTableShell>
        </>
        )}
      </div>
    </>
  );
}
