import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { STORY_MAX_VIDEO_SECONDS } from '../../api/stories';
import '../../styles/story-editor.css';

/**
 * The Camera entry of Pas 2: the phone's own camera inside the red panel, with a shutter
 * for a still and a record button for a clip. Recording stops itself at the client's minute
 * so nothing that would be refused on upload can even be made here.
 *
 * The capture is handed back as a File, which is exactly what the file picker produces, so
 * the editor downstream cannot tell the two apart.
 */
export function StoryCamera({
  onCaptured,
  onCancel,
}: {
  onCaptured: (file: File, durationSeconds?: number) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation('stories');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const { t: tUi } = useTranslation('ui');

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'user' }, audio: true })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => {
        if (!cancelled) setError(t('camera_denied'));
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  /* the running count, which also enforces the minute */
  useEffect(() => {
    if (!recording) return;
    const started = Date.now();
    const id = window.setInterval(() => {
      const seconds = (Date.now() - started) / 1000;
      setElapsed(seconds);
      if (seconds >= STORY_MAX_VIDEO_SECONDS) stop();
    }, 200);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording]);

  function snap() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) onCaptured(new File([blob], `camera${Date.now()}.jpg`, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.92);
  }

  function record() {
    const stream = streamRef.current;
    if (!stream) return;
    /* mp4 where the browser can (Safari), webm otherwise — the extension follows the type
       so the viewer picks the right <source type> later */
    const type = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((t) =>
      MediaRecorder.isTypeSupported(t),
    );
    const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const chunks: BlobPart[] = [];
    const startedAt = Date.now();
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      /* Chrome reports "video/mp4;codecs=vp9,opus" here. The comma inside that parameter
         breaks the part header when it is uploaded — the server then reads no type at all
         and turns the clip away — so only the type itself is kept. */
      const mime = (recorder.mimeType || 'video/webm').split(';')[0].trim();
      const ext = mime.includes('mp4') ? 'mp4' : 'webm';
      const blob = new Blob(chunks, { type: mime });
      onCaptured(
        new File([blob], `camera${Date.now()}.${ext}`, { type: mime }),
        (Date.now() - startedAt) / 1000,
      );
    };
    recorderRef.current = recorder;
    recorder.start();
    setElapsed(0);
    setRecording(true);
  }

  function stop() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  return (
    <div className="story-camera">
      {error ? (
        <p className="add-story-error">{error}</p>
      ) : (
        <div className="story-camera-stage">
          <video ref={videoRef} autoPlay muted playsInline />
          {recording && (
            <span className="story-camera-timer">
              ● {elapsed.toFixed(1)}s / {STORY_MAX_VIDEO_SECONDS}s
            </span>
          )}
        </div>
      )}

      <div className="story-camera-controls">
        <button type="button" className="story-camera-btn" onClick={onCancel}>
          {t('cancel')}
        </button>
        {!error && !recording && (
          <>
            <button type="button" className="story-camera-shutter" onClick={snap} title={tUi('photo')} />
            <button type="button" className="story-camera-btn record" onClick={record}>
              ● {t('record')}
            </button>
          </>
        )}
        {recording && (
          <button type="button" className="story-camera-btn record on" onClick={stop}>
            ■ {t('stop')}
          </button>
        )}
      </div>
    </div>
  );
}
