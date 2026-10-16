import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import '../styles/stream-dot.css';

/**
 * #streamingModalCenter — the Go-Live dialog.
 *
 * The blade keeps it in the layout footer, which is why every page can raise
 * it: the sidebar's STREAMING entry and the phone bar's Stream button open the
 * same one. It lived inside the world sidebar here, out of reach of the bar,
 * so it moves out whole — same markup, same wording, same colours.
 *
 * A guest is told the creator is off air; a signed-in one gets the bio/tags
 * form that opens a room and walks into /start-stream/:room.
 */
export function StreamModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation('content');
  const { user: authUser } = useAuth();
  const navigate = useNavigate();
  const [bio, setBio] = useState('');
  const [tags, setTags] = useState('');
  const [busy, setBusy] = useState(false);
  const { t: tUi } = useTranslation('ui');

  async function submitGoLive(e: React.FormEvent) {
    e.preventDefault();
    if (!bio.trim() || !tags.trim() || busy) return;
    setBusy(true);
    try {
      const { data } = await api.post<{ roomName: string }>('/create-room', {
        bio: bio.trim(),
        tags: tags.trim(),
      });
      if (data.roomName) navigate(`/start-stream/${data.roomName}`);
    } catch {
      /* the blade leaves the dialog open when the room cannot be created */
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="sf-modal-scrim"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 123112311231, overflowY: 'auto' }}
    >
      {/* modal-dialog: 600px, margin 30px auto (top-aligned, horizontally centered) */}
      <div
        className="sf-modal-pop"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 600, maxWidth: 'calc(100% - 20px)', margin: '30px auto', position: 'relative' }}
      >
        <div className="modal-content" style={{ borderRadius: 20, background: 'blueviolet' }}>
          {/* modal-header: padding 15px */}
          <div style={{ border: 0, padding: 15, position: 'relative' }}>
            <button
              type="button"
              onClick={onClose}
              aria-label={tUi('close')}
              style={{ float: 'right', fontSize: 45, fontWeight: 700, lineHeight: 1, opacity: 1, color: '#fff', background: 'none', border: 'none', cursor: 'pointer', marginTop: -2, padding: 0 }}
            >
              ×
            </button>
            {/* David, 16 Oct 2026: "Change title: 📹Directo / Stream — put <br> between title
                and body". The title was "Message" under a superman, and its 20px-high box let
                the form ride up against it; it now takes its own height plus a line's gap. */}
            <div style={{ textAlign: 'center', marginTop: 35, marginBottom: 24 }}>
              <h5 style={{ fontSize: 30, textAlign: 'center', color: '#fff', display: 'inline-block', margin: 0 }}>
                📹{tUi('stream_modal_title')}
              </h5>
            </div>
          </div>
          {/* modal-body: padding 15px */}
          <div style={{ border: 0, padding: 15, position: 'relative' }}>
            {authUser ? (
              <form onSubmit={submitGoLive}>
                <div className="form-group" style={{ display: 'flex' }}>
                  <label style={{ color: '#fff', width: 50 }}>{t('stream_bio')}:</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    required
                    placeholder={t('stream_bio_placeholder')}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    style={{ backgroundColor: '#fff', color: '#000' }}
                  />
                </div>
                <div className="form-group mt-3" style={{ display: 'flex', marginTop: 20 }}>
                  <label style={{ color: '#fff', width: 50 }}>{t('stream_tags')}:</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    placeholder={t('stream_tags_placeholder')}
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    style={{ backgroundColor: '#fff', color: '#000' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
                  <button
                    type="submit"
                    className="btn btn-light"
                    disabled={busy}
                    style={{ padding: '10px 20px', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                  >
                    {/* the bottom bar's own red stream dot, not the 🔴 emoji */}
                    <span className="stream-dot" aria-hidden="true" />
                    {t('stream_start_button')}
                  </button>
                </div>
              </form>
            ) : (
              <h3 style={{ color: '#fff', textAlign: 'center', marginTop: 15, fontSize: 24, fontWeight: 700 }}>
                {tUi('not_on_air')}
              </h3>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
