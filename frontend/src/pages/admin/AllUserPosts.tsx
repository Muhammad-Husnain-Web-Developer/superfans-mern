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
  onChanged: (p: { id: string; noOfLikes: number }) => void;
}) {
  const [amount, setAmount] = useState('');
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

  const patch = useCallback((p: { id: string; noOfLikes: number }) => {
    setPosts((prev) => prev.map((x) => (x.id === p.id ? { ...x, noOfLikes: p.noOfLikes } : x)));
  }, []);

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
