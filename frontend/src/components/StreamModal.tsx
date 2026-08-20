import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

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
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 123112311231, overflowY: 'auto' }}
    >
      {/* modal-dialog: 600px, margin 30px auto (top-aligned, horizontally centered) */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 600, maxWidth: 'calc(100% - 20px)', margin: '30px auto', position: 'relative' }}
      >
        <div className="modal-content" style={{ borderRadius: 20, background: 'blueviolet' }}>
          {/* modal-header: padding 15px */}
          <div style={{ border: 0, padding: 15, position: 'relative' }}>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{ float: 'right', fontSize: 45, fontWeight: 700, lineHeight: 1, opacity: 1, color: '#fff', background: 'none', border: 'none', cursor: 'pointer', marginTop: -2, padding: 0 }}
            >
              ×
            </button>
            <div style={{ textAlign: 'center', height: 20, marginTop: 35 }}>
              <img src="/assets/images/superman2.png" style={{ display: 'inline-block', height: 51 }} alt="" />
              <h5 style={{ fontSize: 30, textAlign: 'center', color: '#fff', display: 'inline-block', margin: 0 }}>
                Message
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
                  <button type="submit" className="btn btn-light" disabled={busy} style={{ padding: '10px 20px' }}>
                    🔴 {t('stream_start_button')}
                  </button>
                </div>
              </form>
            ) : (
              <h3 style={{ color: '#fff', textAlign: 'center', marginTop: 15, fontSize: 24, fontWeight: 700 }}>
                THIS USER IS NOT ON 🔴 AIR.
              </h3>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
