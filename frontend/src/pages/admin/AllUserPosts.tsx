import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { api } from '../../api/client';
import { assetImage, isVideoFile, videoMime } from '../../utils/format';
import { BOOTSTRAP4_CDN, useStandalonePageStyles } from '../../components/StandalonePage';
import { DataTableShell } from '../ads/DataTableShell';

interface PanelPost {
  id: string;
  postId: number | null;
  imageVideo: string | null;
  noOfLikes: number;
  /** the typed ❤️/💩 figure; null means the pill runs on the real votes alone */
  likePercent: number | null;
}

type Flash = { kind: 'success' | 'danger'; text: string } | null;

function PostRow({
  post,
  influencerId,
  onFlash,
  onChanged,
}: {
  post: PanelPost;
  influencerId: number | null;
  onFlash: (f: Flash) => void;
  onChanged: (p: { id: string; noOfLikes?: number; likePercent?: number | null }) => void;
}) {
  const [amount, setAmount] = useState('');
  const [pct, setPct] = useState(post.likePercent == null ? '' : String(post.likePercent));
  const [busy, setBusy] = useState(false);

  const send = useCallback(
    async (action: 'add' | 'remove') => {
      if (!amount) return;
      setBusy(true);
      try {
        const { data } = await api.post<{ message: string; noOfLikes: number }>(
          `/admin/posts/${post.id}/likes`,
          { action, amount },
        );
        onFlash({ kind: 'success', text: data.message });
        onChanged({ id: post.id, noOfLikes: data.noOfLikes });
      } catch (err) {
        const text = isAxiosError(err)
          ? ((err.response?.data as { message?: string } | undefined)?.message ?? 'Something went wrong')
          : 'Something went wrong';
        onFlash({ kind: 'danger', text });
      } finally {
        setBusy(false);
      }
    },
    [amount, post.id, onFlash, onChanged],
  );

  /* the pill's figure: an empty box clears it and hands the post back to its real votes */
  const savePercent = useCallback(async () => {
    setBusy(true);
    try {
      const percent = pct.trim() === '' ? null : Number(pct);
      const { data } = await api.post<{ message: string; likePercent: number | null }>(
        `/admin/posts/${post.id}/like-percent`,
        { percent },
      );
      onFlash({ kind: 'success', text: data.message });
      onChanged({ id: post.id, likePercent: data.likePercent });
    } catch (err) {
      const text = isAxiosError(err)
        ? ((err.response?.data as { message?: string } | undefined)?.message ?? 'Something went wrong')
        : 'Something went wrong';
      onFlash({ kind: 'danger', text });
    } finally {
      setBusy(false);
    }
  }, [pct, post.id, onFlash, onChanged]);

  const media = post.imageVideo;

  return (
    <tr>
      <td>{post.postId ?? '—'}</td>
      <td>
        {media && isVideoFile(media) ? (
          <video controlsList="nodownload" style={{ maxWidth: '100%' }} controls loop>
            <source src={assetImage(media)} type={videoMime(media)} />
          </video>
        ) : media ? (
          <a href={assetImage(media)}>
            <img
              src={assetImage(media)}
              alt="Nueva Modelo Superfans - ¡Bienvenid@ a mi Portfolio!"
              className="img-responsive"
              style={{ borderRadius: '26px', border: '7px solid lightgray', width: 100 }}
            />
          </a>
        ) : null}
      </td>
      <td>{influencerId ?? '—'}</td>
      <td>
        <b>{post.noOfLikes.toLocaleString('en-US')}</b>
      </td>
      <td>
        <input type="number" required value={amount} onChange={(e) => setAmount(e.target.value)} />
      </td>
      <td>
        <input
          type="submit"
          className="btn my-1 btn-success"
          value="Add "
          disabled={busy}
          onClick={() => void send('add')}
        />{' '}
        <input
          type="submit"
          className="btn my-1 btn-danger"
          value="Remove "
          disabled={busy}
          onClick={() => void send('remove')}
        />
      </td>
      <td>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input
            type="number"
            min={0}
            max={100}
            placeholder="auto"
            value={pct}
            style={{ width: 70 }}
            onChange={(e) => setPct(e.target.value)}
          />
          <span>%</span>
          <input
            type="submit"
            className="btn my-1 btn-primary"
            value="Save"
            disabled={busy}
            onClick={() => void savePercent()}
          />
        </div>
      </td>
    </tr>
  );
}

/**
 * influencer/all_user_posts.blade.php — every post of one user, with the
 * likes counter the owner can move by hand.
 *
 * Reached from the Posts button on the all_users panel, and standalone in the
 * same way: Bootstrap 4, a dark-headed striped table, DataTables around it.
 */
export function AllUserPosts() {
  useStandalonePageStyles([BOOTSTRAP4_CDN]);
  const { id = '' } = useParams();
  const [posts, setPosts] = useState<PanelPost[]>([]);
  const [influencerId, setInfluencerId] = useState<number | null>(null);
  const [flash, setFlash] = useState<Flash>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'denied'>('loading');

  useEffect(() => {
    document.title = 'Superfans | All Posts';
  }, []);

  useEffect(() => {
    api
      .get<{ posts: PanelPost[]; user: { mysqlId: number | null } }>(`/admin/users/${id}/posts`)
      .then((r) => {
        setPosts(r.data.posts);
        setInfluencerId(r.data.user.mysqlId);
        setState('ok');
      })
      .catch(() => setState('denied'));
  }, [id]);

  const patch = useCallback((p: { id: string; noOfLikes?: number; likePercent?: number | null }) => {
    setPosts((prev) =>
      prev.map((x) =>
        x.id === p.id
          ? {
              ...x,
              noOfLikes: p.noOfLikes ?? x.noOfLikes,
              likePercent: p.likePercent !== undefined ? p.likePercent : x.likePercent,
            }
          : x,
      ),
    );
  }, []);

  const [bulkPct, setBulkPct] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);

  async function applyBulk() {
    setBulkBusy(true);
    try {
      const percent = bulkPct.trim() === '' ? null : Number(bulkPct);
      const { data } = await api.post<{ message: string; likePercent: number | null }>(
        `/admin/users/${id}/like-percent`,
        { percent },
      );
      setFlash({ kind: 'success', text: data.message });
      setPosts((prev) => prev.map((x) => ({ ...x, likePercent: data.likePercent })));
    } catch (err) {
      const text = isAxiosError(err)
        ? ((err.response?.data as { message?: string } | undefined)?.message ?? 'Something went wrong')
        : 'Something went wrong';
      setFlash({ kind: 'danger', text });
    } finally {
      setBulkBusy(false);
    }
  }

  if (state === 'loading') return null;
  if (state === 'denied') {
    return (
      <div className="container my-4">
        <div className="alert alert-danger">
          <h5>
            <b>Admin access only.</b>
          </h5>
        </div>
      </div>
    );
  }

  return (
    <div className="container my-4">
      {flash && (
        <div className={`alert alert-${flash.kind} alert-dismissible fade show`} role="alert">
          <h5>
            <b>{flash.text}</b>
          </h5>
          <button type="button" className="close" aria-label="Close" onClick={() => setFlash(null)}>
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
      )}

      {/* One figure across every post of this creator — the boost the client asked for,
          alongside the per-post box in the table. Empty clears them all. */}
      <div className="card mb-3">
        <div className="card-body d-flex align-items-center" style={{ gap: 8, flexWrap: 'wrap' }}>
          <b>Help this influencer:</b>
          <span>set ❤️ % 💩 on all {posts.length} post(s)</span>
          <input
            type="number"
            min={0}
            max={100}
            placeholder="auto"
            value={bulkPct}
            style={{ width: 80 }}
            onChange={(e) => setBulkPct(e.target.value)}
          />
          <span>%</span>
          <button className="btn btn-primary" disabled={bulkBusy} onClick={() => void applyBulk()}>
            Apply to all
          </button>
        </div>
      </div>

      <DataTableShell rows={posts} searchText={(p) => `${p.postId ?? ''} ${p.imageVideo ?? ''}`}>
        {(pageRows) => (
          <table className="table table-striped table-bordered dt-responsive nowrap">
            <thead>
              <tr className="bg-dark text-white">
                <th>Post Id</th>
                <th>Post</th>
                <th>Influencer id</th>
                {/* The blade takes these from content.likes; the client asked the
                    table to speak of views instead. The eye rides with the count,
                    the way every view figure is shown across the app. */}
                <th>👁️ Views</th>
                <th>Add Views</th>
                <th>Views Action</th>
                {/* the client's second figure: typed by hand, blank means it is
                    left to the real ❤️/💩 votes */}
                <th>❤️ % 💩</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((p) => (
                <PostRow
                  key={p.id}
                  post={p}
                  influencerId={influencerId}
                  onFlash={setFlash}
                  onChanged={patch}
                />
              ))}
            </tbody>
          </table>
        )}
      </DataTableShell>
    </div>
  );
}
