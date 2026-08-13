import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { assetImage } from '../../utils/format';
import { LOCKED_POST_IMAGE } from '../../utils/networkLogo';

interface AdPost {
  id: string;
  imageVideo: string | null;
}

/** Post thumbnails for promote-post/messages/followers ads — port of loadUserPosts()/renderMorePosts(). */
export function PostPicker({ value, onSelect }: { value: string; onSelect: (id: string) => void }) {
  const [posts, setPosts] = useState<AdPost[]>([]);
  const [shown, setShown] = useState(4);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ posts: AdPost[] }>('/ads/posts')
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
            onClick={() => onSelect(p.id)}
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
