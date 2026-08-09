import { toggleMute } from '../utils/video';

/**
 * The mute/unmute button that sits on every autoplay video
 * (blade: <button class="volume-btn" onclick="toggleMute(...)">).
 * `variant="grid"` uses the inline style from user_posts/user_profile
 * (bottom 22/right 15, 21×20); `variant="world"` relies on the .volume-btn
 * class from the extracted world-page.css (bottom 20/right 20, 25×25).
 */
export function VolumeButton({ videoId, variant = 'grid' }: { videoId: string; variant?: 'grid' | 'world' }) {
  const gridStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: 22,
    right: 15,
    background: 'rgba(0,0,0,0.6)',
    border: 'none',
    borderRadius: '50%',
    width: 21,
    height: 20,
    cursor: 'pointer',
    color: 'white',
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    pointerEvents: 'auto',
  };
  return (
    <button
      className="volume-btn"
      onClick={(e) => {
        e.stopPropagation();
        toggleMute(e, videoId);
      }}
      style={variant === 'grid' ? gridStyle : undefined}
    >
      <i className="fa fa-volume-mute" style={{ fontSize: 12 }}></i>
    </button>
  );
}
