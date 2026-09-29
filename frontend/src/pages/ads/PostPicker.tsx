import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { assetImage } from '../../utils/format';
import { LOCKED_POST_IMAGE } from '../../utils/networkLogo';

interface AdPost {
  id: string;
  imageVideo: string | null;
}

/** Post thumbnails for promote-post/messages/followers ads — port of loadUserPosts()/renderMorePosts(). */
export function PostPicker({
  value,
  onSelect,
}: {
  value: string;
  /** the media comes back with the id: the create form previews what was picked */
  onSelect: (id: string, media: string | null) => void;
}) {
  /* a business working inside a linked account passes its id along (Vinculación Partner) */
  const [params] = useSearchParams();
  const as = params.get('as');
  const [posts, setPosts] = useState<AdPost[]>([]);
  const [shown, setShown] = useState(4);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ posts: AdPost[] }>(`/ads/posts${as ? `?as=${encodeURIComponent(as)}` : ''}`)
      .then(({ data }) => setPosts(data.posts))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-muted mt-2">Loading posts...</p>;
  if (posts.length === 0) return <p className="text-danger mt-2">No posts found to promote.</p>;

  return (
    <>
      <div className="d-flex justify-content-center flex-wrap">
        {posts.slice(0, shown).map((p) => (
          <img
            key={p.id}
            src={p.imageVideo ? assetImage(p.imageVideo) : LOCKED_POST_IMAGE}
            alt=""
            className={`selectPost${value === p.id ? ' selected' : ''}`}
            onClick={() => onSelect(p.id, p.imageVideo)}
          />
        ))}
      </div>
      {shown < posts.length && (
        <button type="button" className="btn btn-secondary btn-sm mt-2" onClick={() => setShown((s) => s + 4)}>
          Show more posts
        </button>
      )}
    </>
  );
}
