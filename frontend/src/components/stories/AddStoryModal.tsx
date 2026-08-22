import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  readVideoDuration,
  uploadStory,
  STORY_MAX_VIDEO_SECONDS,
  type StoryElement,
} from '../../api/stories';
import { StoryEditor } from './StoryEditor';
import { StoryCamera } from './StoryCamera';
import { assetImage } from '../../utils/format';
import '../../styles/add-post-modal.css';
import '../../styles/add-story-modal.css';

/**
 * "Add Storie:" (mockup Pas 2) — the same red modal chrome as Agregar Publicación, with a
 * file picker, the Camera entry and the purple button beneath.
 *
 * Edit carries the file into the editor of Pas 3; Publicació there is what finally uploads.
 * Camera opens the phone's own camera in the same panel and hands its capture on the
 * same path, so a snapshot and a picked file reach the editor identically.
 */
export function AddStoryModal({ onClose, onPosted }: { onClose: () => void; onPosted?: () => void }) {
  const { t } = useTranslation('stories');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /* Pas 3: Edit leaves this first screen and opens the editor over the chosen file; the
     upload waits for Publicació there. */
  const [editing, setEditing] = useState(false);
  const [duration, setDuration] = useState<number | undefined>(undefined);
  const [elements, setElements] = useState<StoryElement[]>([]);
  const [camera, setCamera] = useState(false);

  /* Edit: check the clip's length here, then hand the file to the editor. */
  async function openEditor(e: React.FormEvent) {
    e.preventDefault();
    if (!file || busy) return;
    setError(null);

    let seconds: number | undefined;
    if (file.type.startsWith('video/')) {
      /* measured here so an over-long clip is refused before it is uploaded; the server
         reads the file's own header again and refuses it there too */
      const measured = await readVideoDuration(file);
      if (measured !== null) {
        if (measured > STORY_MAX_VIDEO_SECONDS + 0.5) {
          setError(
            t('video_too_long', { seconds: STORY_MAX_VIDEO_SECONDS, actual: Math.round(measured) }),
          );
          return;
        }
        seconds = measured;
      }
    }
    setDuration(seconds);
    setEditing(true);
  }

  async function publish() {
    if (!file || busy) return;
    setBusy(true);
    try {
      await uploadStory(file, duration, elements);
      onPosted?.();
      onClose();
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(message ?? t('publish_failed'));
    } finally {
      setBusy(false);
    }
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
      <div
        className="modal-dialog modal-dialog-centered add-post-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        {/* every measurement here comes from the mockup — see add-story-modal.css */}
        <div className="modal-content add-story-panel">
          <button
            type="button"
            className="add-story-close"
            onClick={onClose}
            aria-label="Close"
          >
            <span aria-hidden="true">×</span>
          </button>

          <img src={assetImage('superman2.png')} className="add-story-hero" alt="" />
          <h5 className="add-story-title">{t('add_title')}</h5>

          {camera ? (
            <StoryCamera
              onCancel={() => setCamera(false)}
              onCaptured={(captured, seconds) => {
                setFile(captured);
                setDuration(seconds);
                setCamera(false);
                setEditing(true);
              }}
            />
          ) : editing && file ? (
            <>
              <StoryEditor
                file={file}
                elements={elements}
                onChange={setElements}
                onPublish={() => void publish()}
                busy={busy}
              />
              {error && <p className="add-story-error">{error}</p>}
            </>
          ) : (
          <form onSubmit={(e) => void openEditor(e)}>
            <h3 className="add-story-label">{t('select_file')}</h3>

            <div className="add-story-file">
              <input
                ref={inputRef}
                type="file"
                accept="image/*,video/*"
                required
                onChange={(e) => {
                  setError(null);
                  setFile(e.target.files?.[0] ?? null);
                }}
              />
            </div>

            <hr className="add-story-rule" />

            <button
              type="button"
              className="add-story-camera"
              onClick={() => {
                setError(null);
                setCamera(true);
              }}
            >
              {/* the mockup's glyph carries a flash, which is the camera-with-flash
                  emoji rather than the plain one */}
              <span className="glyph">📸</span>
              <span className="label">{t('camera')}</span>
            </button>

            {error && <p className="add-story-error">{error}</p>}

            <button type="submit" className="add-story-submit" disabled={busy || !file}>
              <span>✎</span>
              <span style={{ marginLeft: 2 }}>{t('edit')}</span>
            </button>
          </form>
          )}
        </div>
      </div>
    </div>
  );
}
