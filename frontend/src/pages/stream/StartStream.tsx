import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Room, RoomEvent, createLocalTracks } from 'livekit-client';
import { api } from '../../api/client';
import { assetImage } from '../../utils/format';
import { useStandalonePageStyles } from '../../components/StandalonePage';

interface RoomData {
  userId: string;
  roomName: string;
  userName: string;
  bio: string;
  tags: string;
  followers: number;
  profilePicture: string | null;
}

const BOOST_PLANS = ['1K', '5K', '25K', '100K'] as const;
type BoostPlan = (typeof BOOST_PLANS)[number];

/**
 * Live-stream broadcaster — port of streaming/start-stream.blade.php. Loads the room
 * (bio/tags/owner), connects to LiveKit, publishes the local camera + mic, and shows a
 * live viewer count. If the stream cannot start it opens the "server pack" boost modal,
 * whose four plans go through the shared payment engine (Stripe now, swappable later).
 */
export function StartStream() {
  useStandalonePageStyles(['/page-css/start-stream.css']);
  const { room: roomName = '' } = useParams();
  const { t } = useTranslation('content');
  const { t: tUi } = useTranslation('ui');

  const [data, setData] = useState<RoomData | null>(null);
  const [viewers, setViewers] = useState(0);
  const [boostOpen, setBoostOpen] = useState(false);
  const videoContainer = useRef<HTMLDivElement>(null);
  const roomRef = useRef<Room | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<RoomData>(`/stream/room/${roomName}`)
      .then(({ data: d }) => {
        if (cancelled) return;
        setData(d);
        document.title = `🔴 Live Stream - ${d.userName}`;
        void startBroadcast(d);
      })
      .catch(() => {
        if (!cancelled) setBoostOpen(true);
      });
    return () => {
      cancelled = true;
      void roomRef.current?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomName]);

  async function startBroadcast(d: RoomData) {
    try {
      const { data: tok } = await api.get<{ token: string; url: string }>('/streamtoken', {
        params: { room: d.roomName, user: d.userName },
      });

      const room = new Room();
      roomRef.current = room;

      const updateViewers = () => setViewers(room.remoteParticipants.size);
      room.on(RoomEvent.ParticipantConnected, updateViewers);
      room.on(RoomEvent.ParticipantDisconnected, updateViewers);

      await room.connect(tok.url, tok.token);
      updateViewers();

      const tracks = await createLocalTracks({ audio: true, video: { facingMode: 'user' } });
      for (const track of tracks) {
        if (track.kind === 'video') {
          const el = track.attach();
          el.style.width = '100%';
          el.style.height = 'auto';
          el.style.display = 'block';
          el.style.borderRadius = '8px';
          if (videoContainer.current) {
            videoContainer.current.innerHTML = '';
            videoContainer.current.appendChild(el);
          }
        }
        await room.localParticipant.publishTrack(track);
      }
    } catch {
      setBoostOpen(true);
    }
  }

  async function donate(amount: number) {
    if (!data || !amount || amount <= 0) return;
    try {
      const { data: res } = await api.post<{ url?: string }>('/payments/donation', {
        influencerId: data.userId,
        amount,
      });
      if (res.url) window.location.href = res.url;
    } catch {
      /* ignore — donation could not start */
    }
  }

  function donatePrompt() {
    const v = window.prompt('Enter a donation amount (€):', '5');
    if (v) void donate(Number(v));
  }

  async function buyBoost(plan: BoostPlan) {
    try {
      const { data: res } = await api.post<{ url?: string }>('/payments/stream-boost', { plan });
      if (res.url) window.location.href = res.url;
    } catch {
      /* leave the modal open so the user can retry */
    }
  }

  const tags = (data?.tags ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

  return (
    <>
      <div className="page">
        {/* LEFT: stage (video + band) */}
        <section className="stage">
          <div className="video-wrap">
            <div id="video-container" ref={videoContainer} />
          </div>

          <div className="band">
            <aside className="profile-card">
              <div className="profile-top">
                <img
                  src={
                    data?.profilePicture
                      ? assetImage(data.profilePicture)
                      : assetImage('output-onlinepngtools (2).png')
                  }
                  alt=""
                  style={{ width: 92, height: 92, borderRadius: 74, border: '4px solid white' }}
                />
                <div className="profile-meta">
                  <div className="profile-name">{data?.userName}</div>
                  <div className="row-muted">{(data?.followers ?? 0).toLocaleString()} followers</div>
                  <br />
                  <div className="live-dot">
                    <i /> <span id="viewer-count">{viewers}</span> Users Live
                  </div>
                </div>
              </div>

              <div className="donos">
                <h4>{tUi('stream_donations_heading')}</h4>
                <div className="btns">
                  <button className="chip-btn" type="button" onClick={() => donate(5)}>5€</button>
                  <button className="chip-btn" type="button" onClick={() => donate(10)}>10€</button>
                  <button className="chip-btn" type="button" onClick={() => donate(20)}>20€</button>
                  <button className="chip-btn" type="button" onClick={donatePrompt}>{tUi('donate_custom')}</button>
                </div>
              </div>
            </aside>

            <section className="info-card">
              <div className="title-line">
                <div className="stream-name">
                  <span>🎥 {data?.userName}</span>
                </div>
                <div className="tags">
                  {tags.map((tg) => (
                    <span className="tag" key={tg}>
                      {tg}
                    </span>
                  ))}
                </div>
              </div>

              {data?.bio && <div className="bio">{data.bio}</div>}

              <div className="lists">
                <div className="list">
                  <h5>{tUi('stream_top_donors')}</h5>
                  <ul />
                </div>
                <div className="list">
                  <h5>SUPER FANS</h5>
                  <ul />
                </div>
              </div>
            </section>
          </div>
        </section>

        {/* RIGHT: join requests rail (placeholders, matching the blade) */}
        <aside className="rail">
          <h4>{tUi('stream_join_requests')}</h4>
          <div className="tiles" id="requests">
            {Array.from({ length: 6 }).map((_, i) => (
              <div className="tile" key={i}>
                <span>{tUi('stream_waiting')}</span>
                <div className="speaker">🔇</div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* Super-ads "server pack" boost modal (shown when the stream can't start) */}
      <div className={`sm-modal${boostOpen ? ' open' : ''}`} role="dialog" aria-hidden={!boostOpen}>
        <div className="sm-modal-dialog">
          <div className="sm-modal-content">
            <button className="sm-close-btn" onClick={() => setBoostOpen(false)}>
              ×
            </button>

            <h3 className="sm-modal-title">🎥 {t('stream_title_band')}</h3>
            <p
              className="sm-modal-desc"
              dangerouslySetInnerHTML={{ __html: t('stream_body_band') }}
            />

            <div className="sm-plans">
              <button className="sm-card" onClick={() => buyBoost('1K')}
                dangerouslySetInnerHTML={{ __html: t('stream_form_band1') }} />
              <button className="sm-card sm-popular" onClick={() => buyBoost('5K')}
                dangerouslySetInnerHTML={{ __html: t('stream_form_band2') }} />
              <button className="sm-card" onClick={() => buyBoost('25K')}
                dangerouslySetInnerHTML={{ __html: t('stream_form_band3') }} />
              <button className="sm-card" onClick={() => buyBoost('100K')}
                dangerouslySetInnerHTML={{ __html: t('stream_form_band4') }} />
            </div>

            <a href="mailto:superfansworldapp@gmail.com" className="sm-contact"
              dangerouslySetInnerHTML={{ __html: t('stream_moreForm_band') }} />
            <p className="sm-footer" dangerouslySetInnerHTML={{ __html: t('stream_footer_band') }} />
          </div>
        </div>
      </div>
    </>
  );
}
