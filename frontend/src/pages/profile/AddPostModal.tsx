import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { SwalResult } from '../../components/SwalResult';
import { ConfirmDialog } from '../../components/ConfirmDialog';
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
 * One of the creator's own posts as it appears in either modal: the thumbnail with the eye
 * and the bin under it. The blade repeats this markup in #add_post_modal and again in
 * #all_post_modal (layouts_direct_user/footer.blade.php:2413 and :2578); it is written once
 * here so the two cannot drift apart.
 */
function PostTile({
  post,
  onToggle,
  onDelete,
  toggleTitle,
  deleteTitle,
}: {
  post: ProfilePost;
  onToggle: () => void;
  onDelete: () => void;
  toggleTitle: string;
  deleteTitle: string;
}) {
  return (
    <div style={{ marginTop: 15, textAlign: 'center' }}>
      {/* Every thumbnail in the same 70px box. The blade only caps the width, so a portrait
          photo stands twice as tall as a landscape one and the rows come out ragged — the
          client's drawing has them even. `cover` fills the box without squashing anything. */}
      <div className="add-post-thumb">
        {post.imageVideo && isVideoFile(post.imageVideo) ? (
          <video
            controls
            loop
            controlsList="nodownload"
            poster={post.thumbnail ? assetImage(`thumbnails/${post.thumbnail}`) : undefined}
          >
            <source src={assetImage(post.imageVideo)} type={videoMime(post.imageVideo)} />
          </video>
        ) : (
          <img src={post.imageVideo ? assetImage(post.imageVideo) : LOCKED_POST_IMAGE} alt="" />
        )}
      </div>
      <div style={{ marginTop: 4 }}>
        <i
          className={`fa ${post.visible ? 'fa-eye' : 'fa-eye-slash'}`}
          title={toggleTitle}
          onClick={onToggle}
          style={{ color: 'white', cursor: 'pointer', marginRight: 10 }}
        ></i>
        <i
          className="fa fa-trash"
          title={deleteTitle}
          onClick={onDelete}
          style={{ color: 'white', cursor: 'pointer' }}
        ></i>
      </div>
    </div>
  );
}

/** how many of the creator's posts the first modal shows before "ALL POSTS ..." takes over.
    The blade stops at six (`->limit(6)`); the client asked for "a little bit more", and ten
    is what his own drawing shows — two rows of five. */
const POSTS_IN_MODAL = 10;

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
  /* #all_post_modal — the blade's second dialog, reached from "ALL POSTS ..." and left again
     by the arrow at its top left (layouts_direct_user/footer.blade.php:2542, and the pair of
     handlers at :5430 that swap one modal for the other). */
  const [allOpen, setAllOpen] = useState(false);
  /* the bin icon's own confirm — id of the post pending confirmation, or null when closed */
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { t } = useTranslation('content');
  const { t: tUi } = useTranslation('ui');
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
    setDeleting(true);
    try {
      await api.delete(`/posts/${id}`).catch(() => undefined);
      onChanged();
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
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
        title={tUi('post_added')}
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
      {/* the blade hides this one the moment the second opens
          (`$('#add_post_modal').modal('hide')`, footer.blade.php:5434) and shows it again on
          the way back, so the two are never on screen together */}
      <div
        className="modal-dialog modal-dialog-centered add-post-dialog"
        hidden={allOpen}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content" style={{ borderRadius: 20, background: 'red' }}>
          <div className="modal-header" style={{ border: 0 }}>
            <button
              type="button"
              className="close d-block"
              onClick={onClose}
              aria-label={tUi('close')}
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
                {/* The box holds only what is being typed. It used to fall back to the
                    tags already chosen, so after picking one the name stayed in the box and
                    had to be cleared by hand before the next search; the chosen ones are
                    listed as chips underneath, which is where they belong. */}
                <input
                  type="text"
                  value={tagQuery}
                  onChange={(e) => {
                    const typed = e.target.value;
                    /* a comma ends a name — the hint above the box says so */
                    if (!typed.includes(',')) {
                      setTagQuery(typed);
                      return;
                    }
                    const parts = typed.split(',');
                    const rest = parts.pop() ?? '';
                    const done = parts.map((n) => n.trim()).filter(Boolean);
                    if (done.length > 0) {
                      setTags((prev) => [...prev, ...done.filter((n) => !prev.includes(n))]);
                    }
                    setTagQuery(rest);
                  }}
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
                            setTags((prev) => (prev.includes(s.name) ? prev : [...prev, s.name]));
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

            {/* Show/Hide all sits under that heading, where the client asked for it — the
                blade has it away at the foot of the strip, past the posts. */}
            <button
              type="button"
              onClick={() => void toggleAll()}
              className="add-post-toggle-all"
            >
              <i className="fa fa-eye" aria-hidden="true"></i> {tUi('toggle_all')}
            </button>

            {/* The run of posts with "ALL POSTS ..." standing the full height of it at the
                right. The blade centres that button under the strip instead; the client drew
                it upright beside the posts, which is what this is. */}
            <div className="add-post-mine">
              <div className="add-post-grid">
                {myPosts.slice(0, POSTS_IN_MODAL).map((p) => (
                  <PostTile
                    key={p.id}
                    post={p}
                    onToggle={() => void toggleVisibility(p.id)}
                    onDelete={() => setConfirmDeleteId(p.id)}
                    toggleTitle={tUi('toggle_visibility')}
                    deleteTitle={tUi('delete')}
                  />
                ))}
              </div>
              <button type="button" className="add-post-all-btn" onClick={() => setAllOpen(true)}>
                {t('all_posts', { defaultValue: 'All Posts' })} ...
              </button>
            </div>
          </div>
        </div>
      </div>

      {allOpen && (
        <div
          className="modal-dialog modal-dialog-centered add-post-dialog add-post-all-dialog"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-content" style={{ borderRadius: 20, background: 'red' }}>
            <div className="modal-header" style={{ border: 0 }}>
              {/* the arrow the blade puts at the left, which closes this and brings the first
                  dialog back rather than dropping the creator out of both */}
              <button
                type="button"
                className="close d-block add-post-back"
                onClick={() => setAllOpen(false)}
                aria-label={tUi('back')}
              >
                <i className="fas fa-arrow-left" aria-hidden="true"></i>
              </button>
              <button
                type="button"
                className="close d-block"
                onClick={onClose}
                aria-label={tUi('close')}
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
                  {t('all_posts', { defaultValue: 'All Posts' })}
                </h5>
              </div>
            </div>

            <div className="modal-body post-modal" style={{ border: 0, padding: 15 }}>
              <p style={{ color: 'white', fontWeight: 600, margin: 0, marginTop: 20 }}>
                {t('my_posts', { defaultValue: 'My posts' })}
              </p>
              {/* every one of them here, where the first dialog showed only the newest ten */}
              <div className="add-post-grid add-post-grid-all">
                {myPosts.map((p) => (
                  <PostTile
                    key={p.id}
                    post={p}
                    onToggle={() => void toggleVisibility(p.id)}
                    onDelete={() => setConfirmDeleteId(p.id)}
                    toggleTitle={tUi('toggle_visibility')}
                    deleteTitle={tUi('delete')}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <ConfirmDialog
          title={tUi('confirm_delete_post_title')}
          text={tUi('confirm_delete_post_text')}
          confirmText={tUi('confirm_delete_post_confirm')}
          cancelText={tUi('cancel')}
          busy={deleting}
          onConfirm={() => void deletePost(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  );
}
