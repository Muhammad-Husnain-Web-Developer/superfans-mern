import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Room, RoomEvent, type RemoteTrack } from 'livekit-client';
import { api } from '../../api/client';
import { useStandalonePageStyles } from '../../components/StandalonePage';

/**
 * Live stream viewer — port of watch-live.blade.php. A standalone black page
 * (it loads none of the layout CSS), joining a LiveKit room named by ?room= as
 * ?user=, and listing the participants.
 */
export function WatchLive() {
  useStandalonePageStyles(['/page-css/watch-live.css']);

  const [params] = useSearchParams();
  const roomName = params.get('room') || 'myroom';
  const { t: tUi } = useTranslation('ui');
  const [userName] = useState(
    () => params.get('user') || `guest_${Math.floor(Math.random() * 10000)}`,
  );

  const [status, setStatus] = useState<'idle' | 'connecting' | 'live' | 'failed'>('idle');
  const [viewers, setViewers] = useState<string[]>([]);
  const videoContainer = useRef<HTMLDivElement>(null);
  const roomRef = useRef<Room | null>(null);

  useEffect(() => {
    document.title = tUi('watch_live_title');
    return () => {
      void roomRef.current?.disconnect();
    };
  }, []);

  async function startWatching() {
    setStatus('connecting');
    try {
      const { data } = await api.get<{ token: string; url: string }>('/streamtoken', {
        params: { room: roomName, user: userName },
      });

      const room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        const el = track.attach();
        if (track.kind === 'video') {
          el.style.width = '100%';
          el.style.height = 'auto';
          el.style.display = 'block';
          videoContainer.current?.appendChild(el);
        } else {
          document.body.appendChild(el);
        }
      });

      const refreshViewers = () =>
        setViewers([
          `${room.localParticipant.identity} (You)`,
          ...[...room.remoteParticipants.values()].map((p) => p.identity),
        ]);

      room.on(RoomEvent.ParticipantConnected, refreshViewers);
      room.on(RoomEvent.ParticipantDisconnected, refreshViewers);

      await room.connect(data.url, data.token);
      refreshViewers();
      setStatus('live');
    } catch {
      setStatus('failed');
    }
  }

  return (
    <>
      <h2>{tUi('watch_live_heading')}</h2>

      {status !== 'live' && (
        <button id="startBtn" onClick={startWatching} disabled={status === 'connecting'}>
          ▶️ Start Watching
        </button>
      )}
      {status === 'connecting' && <div id="loadingIndicator">{tUi('watch_connecting')}</div>}
      {status === 'failed' && <div id="loadingIndicator">{tUi('watch_failed')}</div>}

      <div id="video-container" ref={videoContainer}></div>

      <p>
        Room: <span id="roomName">{roomName}</span>
      </p>
      <p>
        User: <span id="userName">{userName}</span>
      </p>

      <h3>{tUi('watch_viewers')}</h3>
      <ul id="viewerList">
        {viewers.map((v) => (
          <li key={v}>{v}</li>
        ))}
      </ul>
    </>
  );
}
