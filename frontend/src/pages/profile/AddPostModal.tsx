import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { SwalResult } from '../../components/SwalResult';
import { assetImage, isVideoFile, videoMime } from '../../utils/format';
import { LOCKED_POST_IMAGE } from '../../utils/networkLogo';
import type { ProfilePost } from '../../api/profiles';
import '../../styles/add-post-modal.css';

interface TagHit {
  name: string;
  verified: boolean;
}

interface AddPostModalProps {
  myPosts: ProfilePost[];
  onClose: () => void;
  /** called after any change (post added/deleted/visibility) so the page refetches */
  onChanged: () => void;
}

/**
 * Pixel parity with #add_post_modal (layouts_influencer/footer.blade.php):
 * red rounded modal, superman icon, file input, people tagging with
 * suggestions, purple ✎ Post button, "My posts" management strip.
 */
export function AddPostModal({ myPosts, onClose, onChanged }: AddPostModalProps) {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  /* The blade redirects back with a `post_added` flash and re-opens this modal, so the new
     post shows in its own list. Here the modal closed the moment the upload finished and
     the page underneath never changed, so nothing at all happened on screen. It confirms
     the post now and then goes to the posts page, where the post itself is. */
  const [posted, setPosted] = useState(false);
  const { t } = useTranslation('content');
  const { t: tNav } = useTranslation('nav');

  const [file, setFile] = useState<File | null>(null);
  const [tagQuery, setTagQuery] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<TagHit[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = tagQuery.trim();
    if (!q) {
      setSuggestions([]);
      return;
    }
    timer.current = setTimeout(() => {
      api
        .get<{ success: boolean; data: TagHit[] }>(`/users/search/influencers?query=${encodeURIComponent(q)}`)
        .then((r) => setSuggestions(r.data.data.slice(0, 8)))
        .catch(() => setSuggestions([]));
    }, 200);
  }, [tagQuery]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('postImageVideo', file);
      if (tags.length > 0) form.append('tags', tags.join(','));
      await api.post('/posts', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      onChanged();
      setSubmitting(false);
      setPosted(true);
    } catch {
      setSubmitting(false);
    }
  }

  async function toggleVisibility(id: string) {
    await api.post(`/posts/${id}/toggle-visibility`).catch(() => undefined);
    onChanged();
  }

  async function deletePost(id: string) {
    await api.delete(`/posts/${id}`).catch(() => undefined);
    onChanged();
  }

  async function toggleAll() {
    await api.post('/posts/toggle-all-visibility').catch(() => undefined);
    onChanged();
  }

  /* The confirmation stands on its own — the upload is finished and there is nothing left
     to do in the form. "Post Added" is the blade's own flash text (InfluencerController
     add_post). Its OK leads to the posts page, carrying a stamp so that page refetches
     even when it is the page already underneath. */
  if (posted) {
    return (
      <SwalResult
        icon="success"
        title="Post Added"
        onClose={() => {
          setPosted(false);
          onClose();
          navigate(authUser?.role === 'influencer' ? '/influencer/posts' : '/user/posts', {
            state: { postAdded: Date.now() },
          });
        }}
      />
    );
  }

  return (
    <div
      className="modal fade in"
      style={{
        zIndex: 123122,
        display: 'block',
        position: 'fixed',
        inset: 0,
        overflowY: 'auto',
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={onClose}
    >
      {/* the margin lives in the stylesheet: it has to change at 768px, which an
          inline style cannot express */}
      <div
        className="modal-dialog modal-dialog-centered add-post-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content" style={{ borderRadius: 20, background: 'red' }}>
          <div className="modal-header" style={{ border: 0 }}>
            <button
              type="button"
              className="close d-block"
              onClick={onClose}
              aria-label="Close"
              style={{
                fontSize: 45,
                opacity: 1,
                color: 'white',
                background: 'transparent',
                border: 0,
                float: 'right',
                lineHeight: 1,
                cursor: 'pointer',
              }}
            >
              <span aria-hidden="true">×</span>
            </button>
            <div style={{ textAlign: 'center', marginTop: 35 }}>
              <img
                src={assetImage('superman2.png')}
                style={{ display: 'inline-block', height: 51 }}
                alt=""
              />
              <h5
                className="modal-title"
                style={{ fontSize: 30, textAlign: 'center', color: 'white', display: 'inline-block' }}
              >
                {tNav('add_post', { defaultValue: 'Add Post' })}
              </h5>
            </div>
          </div>

          <div className="modal-body post-modal" style={{ border: 0, padding: 15 }}>
            <form onSubmit={(e) => void submit(e)}>
              <h3
                style={{
                  margin: 0,
                  color: 'white',
                  fontFamily: "'Rockwell Nova'",
                  fontWeight: 800,
                  marginTop: 20,
                  marginBottom: 10,
                }}
              >
                {t('posts_label', { defaultValue: 'Posts' })}
              </h3>
              <div className="custom-file" style={{ display: 'flex' }}>
                <label style={{ marginRight: 10, color: 'white', marginTop: 3 }}>
                  {tNav('add_post', { defaultValue: 'Add Post' })}
                </label>
                <input
                  type="file"
                  accept="image/*,video/*"
                  required
                  style={{ color: 'white', marginTop: 3 }}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>

              <div style={{ marginTop: 10, position: 'relative' }}>
                <label style={{ color: 'white', display: 'block' }}>
                  {t('tag_people', { defaultValue: 'Tag people' })}
                </label>
                <small style={{ color: '#ccc', display: 'block', marginTop: 4 }}>
                  {t('tag_instructions', { defaultValue: '' })}
                </small>
                <br />
                <input
                  type="text"
                  value={tagQuery ? tagQuery : tags.join(',')}
                  onChange={(e) => setTagQuery(e.target.value.split(',').pop() ?? '')}
                  placeholder={t('type_username_or_name', { defaultValue: 'Type username or name' })}
                  style={{ width: '100%', padding: 5, border: '1px solid lightgray', borderRadius: 5 }}
                />
                {suggestions.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0 }}>
                    <ul
                      style={{
                        listStyle: 'none',
                        paddingLeft: 0,
                        background: '#fff',
                        border: '1px solid #ccc',
                        width: '100%',
                        margin: 0,
                        zIndex: 1000,
                        position: 'relative',
                        maxHeight: 150,
                        overflowY: 'auto',
                      }}
                    >
                      {suggestions.map((s) => (
                        <li
                          key={s.name}
                          onClick={() => {
                            if (!tags.includes(s.name)) setTags([...tags, s.name]);
                            setTagQuery('');
                            setSuggestions([]);
                          }}
                          style={{ padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid #eee' }}
                        >
                          {s.name}
                          {s.verified && (
                            <img
                              src={assetImage('verified.png')}
                              alt=""
                              width={16}
                              height={16}
                              style={{ marginLeft: 5, display: 'inline-block' }}
                            />
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {tags.length > 0 && (
                  <p style={{ color: 'white', marginTop: 6, marginBottom: 0, fontSize: 13 }}>
                    {tags.map((tg) => (
                      <span key={tg} style={{ marginRight: 8 }}>
                        @{tg}{' '}
                        <span
                          style={{ cursor: 'pointer' }}
                          onClick={() => setTags(tags.filter((x) => x !== tg))}
                        >
                          ×
                        </span>
                      </span>
                    ))}
                  </p>
                )}
              </div>
              <br />
              <center>
                <button
                  type="submit"
                  className="save_btn turn_btn"
                  disabled={submitting || !file}
                  style={{
                    background: '#724abb',
                    color: '#fff',
                    padding: '4px 35px',
                    fontWeight: 900,
                    outline: 0,
                    fontSize: '1.1em',
                    border: '3px solid #4712a6',
                    fontFamily:
                      "Consolas, Menlo, Monaco, 'Lucida Console', 'Liberation Mono', 'DejaVu Sans Mono', 'Bitstream Vera Sans Mono', 'Courier New', monospace, serif",
                    cursor: 'pointer',
                  }}
                >
                  <span>✎</span>
                  <span style={{ marginLeft: 2 }}>{t('post', { defaultValue: 'Post' })}</span>
                </button>
              </center>
            </form>

            {submitting && (
              <img
                src={assetImage('loading2.gif')}
                style={{ maxWidth: '100%', margin: '0 auto', display: 'block', width: 50 }}
                alt=""
              />
            )}

            <br />
            <p style={{ color: 'white', fontWeight: 600, margin: 0, marginTop: 15 }}>
              {t('my_posts', { defaultValue: 'My posts' })}
            </p>

            <div className="container-fluid">
              <div className="row" style={{ display: 'flex', flexWrap: 'wrap' }}>
                <div className="col-md-9" style={{ flex: '1 1 70%' }}>
                  {myPosts.slice(0, 6).map((p) => (
                    <div
                      key={p.id}
                      style={{
                        paddingLeft: '3%',
                        paddingRight: '3%',
                        display: 'inline-block',
                        marginTop: 15,
                        textAlign: 'center',
                      }}
                    >
                      {p.imageVideo && isVideoFile(p.imageVideo) ? (
                        <video
                          controls
                          loop
                          controlsList="nodownload"
                          style={{ maxWidth: 70, border: 0, marginBottom: -6 }}
                          poster={p.thumbnail ? assetImage(`thumbnails/${p.thumbnail}`) : undefined}
                        >
                          <source src={assetImage(p.imageVideo)} type={videoMime(p.imageVideo)} />
                        </video>
                      ) : (
                        <img
                          src={p.imageVideo ? assetImage(p.imageVideo) : LOCKED_POST_IMAGE}
                          style={{ maxWidth: 70, display: 'inline-block' }}
                          alt=""
                        />
                      )}
                      <div style={{ marginTop: 4 }}>
                        <i
                          className={`fa ${p.visible ? 'fa-eye' : 'fa-eye-slash'}`}
                          title="Toggle visibility"
                          onClick={() => void toggleVisibility(p.id)}
                          style={{ color: 'white', cursor: 'pointer', marginRight: 10 }}
                        ></i>
                        <i
                          className="fa fa-trash"
                          title="Delete"
                          onClick={() => void deletePost(p.id)}
                          style={{ color: 'white', cursor: 'pointer' }}
                        ></i>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="col-md-3" style={{ flex: '1 1 30%', marginTop: 15 }}>
                  <button
                    type="button"
                    onClick={() => void toggleAll()}
                    style={{
                      background: 'transparent',
                      color: 'white',
                      border: '2px solid white',
                      padding: '4px 10px',
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                  >
                    {t('toggle_all', { defaultValue: 'Show/Hide all' })}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
