import { useState } from 'react';
import { isAxiosError } from 'axios';
import { api } from '../../api/client';

/**
 * Posting on a linked account's profile, from inside Super Ads Center.
 *
 * The other half of what an accepted vinculación grants: the client's note of 28 Sep 2026 says
 * a linked business may "Post videos or Pictures in their profiles", and on 29 Sep he placed the
 * work "Inside of SUPER ADS CENTER" and asked for the result to read "exactly like the
 * User/Influencer normal post".
 *
 * So this is deliberately small. The app's own AddPostModal is a whole posts manager — its own
 * list, visibility toggles, a redirect to the posts page afterwards — none of which belongs to
 * a business working in someone else's account. This does the one thing: choose a file, add
 * tags, upload it under that account. The server makes the thumbnail and stores the post with
 * no mark of who uploaded it, which is what "exactly like a normal post" means.
 */
export function PostForLinked({
  targetId,
  handle,
  onClose,
}: {
  targetId: string;
  handle: string;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [tags, setTags] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const MONO = 'Consolas, "Courier New", monospace';

  async function upload() {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('postImageVideo', file);
      /* the same comma-separated list the app's own uploader sends */
      if (tags.trim()) form.append('tags', tags.trim());
      form.append('onBehalfOf', targetId);
      await api.post('/posts', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setDone(true);
    } catch (e) {
      setError(
        isAxiosError(e)
          ? ((e.response?.data as { message?: string } | undefined)?.message ?? 'Upload failed.')
          : 'Upload failed.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          border: '3px solid #585858',
          padding: 26,
          width: 460,
          maxWidth: '92%',
          fontFamily: MONO,
        }}
      >
        <h4 style={{ fontWeight: 700, marginTop: 0 }}>Post on @{handle}</h4>

        {done ? (
          <>
            <p style={{ marginTop: 18 }}>Posted on @{handle}.</p>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#6622e5',
                color: '#fff',
                border: '3px solid #520be0',
                borderRadius: 0,
                fontWeight: 700,
                padding: '8px 20px',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </>
        ) : (
          <>
            <p style={{ color: '#666', fontSize: 13 }}>
              It will appear as a normal post on their profile.
            </p>

            <input
              type="file"
              accept="image/*,video/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              style={{ display: 'block', margin: '14px 0', width: '100%' }}
            />

            <input
              type="text"
              placeholder="tags, comma separated (optional)"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              style={{
                width: '100%',
                background: '#d9d9d9',
                border: '2px solid #585858',
                borderRadius: 0,
                height: 40,
                padding: '0 10px',
                fontFamily: MONO,
              }}
            />

            {error && <p style={{ color: '#b00', marginTop: 12 }}>{error}</p>}

            <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: '#d3d3d3',
                  color: '#222',
                  border: '3px solid #585858',
                  borderRadius: 0,
                  fontWeight: 700,
                  padding: '8px 18px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void upload()}
                disabled={!file || busy}
                style={{
                  background: !file || busy ? '#b9a3e8' : '#6622e5',
                  color: '#fff',
                  border: '3px solid #520be0',
                  borderRadius: 0,
                  fontWeight: 700,
                  padding: '8px 18px',
                  cursor: !file || busy ? 'default' : 'pointer',
                }}
              >
                {busy ? 'Uploading…' : 'Post'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
