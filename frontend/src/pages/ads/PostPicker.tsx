import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { assetImage, isVideoFile } from '../../utils/format';
import { LOCKED_POST_IMAGE } from '../../utils/networkLogo';

interface AdPost {
  id: string;
  imageVideo: string | null;
  /** a video post's poster frame, when one was made for it */
  thumbnail?: string | null;
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

  /* A post chosen before this list existed — `/super-ads/buy/:postId`, where the id arrives
     with the route and the thumbnails only load afterwards. The id alone cannot draw the
     preview, so once the posts are in, the matching one is reported back the same way a click
     would report it. Once per id: `reportedRef` stops the effect answering its own update.
     An id that is not in this account's posts simply never matches, and the advertiser picks
     one by hand as before. */
  const reportedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!value || reportedRef.current === value || posts.length === 0) return;
    const picked = posts.find((p) => p.id === value);
    if (!picked) return;
    reportedRef.current = value;
    onSelect(picked.id, picked.imageVideo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, posts]);

  if (loading) return <p className="text-muted mt-2">Loading posts...</p>;
  if (posts.length === 0) return <p className="text-danger mt-2">No posts found to promote.</p>;

  return (
    <>
      <div className="d-flex justify-content-center flex-wrap">
        {posts.slice(0, shown).map((p) => {
          const className = `selectPost${value === p.id ? ' selected' : ''}`;
          /* A clip cannot go in an <img> — it would draw as a broken picture, which is what
             the picker did for the whole list before videos were allowed into it at all.
             With a poster frame it stays a still; without one the clip itself is drawn,
             muted and looping, because this is a thumbnail and not something to watch. */
          if (p.imageVideo && isVideoFile(p.imageVideo)) {
            return p.thumbnail ? (
              <img
                key={p.id}
                src={assetImage(`thumbnails/${p.thumbnail}`)}
                alt=""
                className={className}
                onClick={() => onSelect(p.id, p.imageVideo)}
              />
            ) : (
              <video
                key={p.id}
                src={assetImage(p.imageVideo)}
                muted
                loop
                autoPlay
                playsInline
                className={className}
                onClick={() => onSelect(p.id, p.imageVideo)}
              />
            );
          }
          return (
            <img
              key={p.id}
              src={p.imageVideo ? assetImage(p.imageVideo) : LOCKED_POST_IMAGE}
              alt=""
              className={className}
              onClick={() => onSelect(p.id, p.imageVideo)}
            />
          );
        })}
      </div>
      {shown < posts.length && (
        <button type="button" className="btn btn-secondary btn-sm mt-2" onClick={() => setShown((s) => s + 4)}>
          Show more posts
        </button>
      )}
    </>
  );
}
