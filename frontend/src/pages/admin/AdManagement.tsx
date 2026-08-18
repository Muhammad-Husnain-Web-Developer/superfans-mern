import { useCallback, useEffect, useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import { api } from '../../api/client';
import { assetImage, isVideoFile, videoMime } from '../../utils/format';
import {
  BOOTSTRAP46_CDN,
  DATATABLES_BOOTSTRAP4_CSS,
  useStandalonePageStyles,
} from '../../components/StandalonePage';
import { DataTableShell } from '../ads/DataTableShell';

interface ManagedAd {
  id: string;
  adId: number | null;
  media: string | null;
  link: string | null;
  status: boolean;
}

const COLUMNS = ['ID', 'Media', 'Link', 'Status', 'Actions'];

/** What each column orders by, the way DataTables reads the rendered cell. */
const SORT_KEYS: ((a: ManagedAd) => string)[] = [
  (a) => String(a.adId ?? ''),
  (a) => a.media ?? '',
  (a) => a.link ?? 'N/A',
  (a) => (a.status ? 'Running' : 'Stopped'),
  (a) => (a.status ? 'Stop Delete' : 'Play Delete'),
];

/** DataTables' string ordering: lowercase, then a plain comparison. */
function compare(a: string, b: string): number {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x < y ? -1 : x > y ? 1 : 0;
}

/**
 * influencer/ads.blade.php — the owner's Ad Management screen.
 *
 * A standalone Bootstrap 4.6 page: a heading, the "Add New Ad" button over a
 * collapsed upload card, and a DataTable of every ad newest id first, each row
 * offering Play/Stop and Delete.
 */
export function AdManagement() {
  useStandalonePageStyles([BOOTSTRAP46_CDN, DATATABLES_BOOTSTRAP4_CSS]);

  const [ads, setAds] = useState<ManagedAd[]>([]);
  const [state, setState] = useState<'loading' | 'ok' | 'denied'>('loading');
  const [success, setSuccess] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [sort, setSort] = useState<{ col: number; dir: 'asc' | 'desc' }>({ col: 0, dir: 'asc' });
  const [file, setFile] = useState<{ name: string; dataUrl: string } | null>(null);
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = 'Superfans | Ad Management';
  }, []);

  const load = useCallback(() => {
    api
      .get<{ ads: ManagedAd[] }>('/admin/ad-management')
      .then((r) => {
        setAds(r.data.ads);
        setState('ok');
      })
      .catch(() => setState('denied'));
  }, []);

  useEffect(load, [load]);

  const sorted = useMemo(() => {
    const read = SORT_KEYS[sort.col];
    if (!read) return ads;
    const factor = sort.dir === 'asc' ? 1 : -1;
    /* the ID column holds numbers, which DataTables orders numerically */
    return [...ads].sort((a, b) =>
      sort.col === 0
        ? ((a.adId ?? 0) - (b.adId ?? 0)) * factor
        : compare(read(a), read(b)) * factor,
    );
  }, [ads, sort]);

  const fail = (err: unknown) =>
    isAxiosError(err)
      ? ((err.response?.data as { message?: string } | undefined)?.message ?? 'Something went wrong')
      : 'Something went wrong';

  async function upload() {
    if (!file) return;
    setBusy(true);
    try {
      const { data } = await api.post<{ message: string }>('/admin/ad-management', {
        media: file.dataUrl,
        link,
      });
      setSuccess(data.message);
      setFormOpen(false);
      setFile(null);
      setLink('');
      load();
    } catch (err) {
      setSuccess(fail(err));
    } finally {
      setBusy(false);
    }
  }

  async function act(ad: ManagedAd, what: 'toggle' | 'delete') {
    if (what === 'delete' && !window.confirm('Delete this ad?')) return;
    setBusy(true);
    try {
      const { data } = await api.post<{ message: string }>(`/admin/ad-management/${ad.id}/${what}`);
      setSuccess(data.message);
      load();
    } catch (err) {
      setSuccess(fail(err));
    } finally {
      setBusy(false);
    }
  }

  if (state === 'loading') return null;
  if (state === 'denied') {
    return (
      <div className="container mt-4">
        <div className="alert alert-danger">Admin access only.</div>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <h2 className="mb-4">Ad Management</h2>

      {success && (
        <div className="alert alert-success alert-dismissible fade show" role="alert">
          {success}
          <button type="button" className="close" onClick={() => setSuccess(null)}>
            &times;
          </button>
        </div>
      )}

      {/* the blade toggles this card with jQuery; the button is the same one */}
      <button type="button" className="btn btn-primary mb-3" onClick={() => setFormOpen((v) => !v)}>
        Add New Ad
      </button>

      <div id="addAdForm" className="card p-3 mb-4" style={{ display: formOpen ? 'block' : 'none' }}>
        <div className="form-group">
          <label htmlFor="media">Media File</label>
          <input
            type="file"
            id="media"
            className="form-control"
            required
            accept=".jpeg,.jpg,.png,.mp4,.webm"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) {
                setFile(null);
                return;
              }
              const reader = new FileReader();
              reader.onload = () => setFile({ name: f.name, dataUrl: String(reader.result) });
              reader.readAsDataURL(f);
            }}
          />
        </div>
        <div className="form-group">
          <label htmlFor="link">Link </label>
          <input
            type="url"
            id="link"
            className="form-control"
            placeholder="https://..."
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="btn btn-success"
          disabled={busy || !file}
          onClick={() => void upload()}
        >
          Upload
        </button>
      </div>

      <DataTableShell rows={sorted} searchText={(a) => `${a.adId ?? ''} ${a.media ?? ''} ${a.link ?? ''}`} numbered>
        {(pageRows) => (
          <table className="table table-bordered table-striped dataTable no-footer" id="adsTable">
            <thead className="thead-dark">
              <tr>
                {COLUMNS.map((label, i) => (
                  <th
                    key={label}
                    className={`sorting${sort.col === i ? ` sorting_${sort.dir}` : ''}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() =>
                      setSort((s) => ({ col: i, dir: s.col === i && s.dir === 'asc' ? 'desc' : 'asc' }))
                    }
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((ad) => (
                <tr key={ad.id}>
                  <td>{ad.adId}</td>
                  <td>
                    {ad.media && isVideoFile(ad.media) ? (
                      <video width={150} controls>
                        <source src={assetImage(ad.media)} type={videoMime(ad.media)} />
                        Your browser does not support the video tag.
                      </video>
                    ) : ad.media ? (
                      <img src={assetImage(ad.media)} width={100} alt="Ad Image" />
                    ) : null}
                  </td>
                  <td>
                    {ad.link ? (
                      <a href={ad.link} target="_blank" rel="noreferrer">
                        {ad.link}
                      </a>
                    ) : (
                      <span className="text-muted">N/A</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge badge-${ad.status ? 'success' : 'secondary'}`}>
                      {ad.status ? 'Running' : 'Stopped'}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`btn btn-sm btn-${ad.status ? 'warning' : 'primary'}`}
                      disabled={busy}
                      onClick={() => void act(ad, 'toggle')}
                    >
                      {ad.status ? 'Stop' : 'Play'}
                    </button>{' '}
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      disabled={busy}
                      onClick={() => void act(ad, 'delete')}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DataTableShell>
    </div>
  );
}
