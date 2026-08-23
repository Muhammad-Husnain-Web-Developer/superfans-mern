import { assetImage } from '../../utils/format';
import '../../styles/stories.css';

/**
 * An avatar wearing the rainbow story ring (mockups Pas 5 and Pas 7). Rendering it without
 * a ring is deliberate: the profile header shows the same picture whether or not there is a
 * live story, so one component covers both and the page does not branch on it.
 */
export function StoryRing({
  picture,
  size = 64,
  ring = true,
  seen = false,
  alt = '',
  onClick,
  title,
}: {
  picture: string | null;
  size?: number;
  ring?: boolean;
  /** already watched — the ring greys out, as Instagram's does */
  seen?: boolean;
  alt?: string;
  onClick?: () => void;
  title?: string;
}) {
  /* the photo is round whether or not a ring is drawn around it — without this an
     un-ringed avatar (nothing posted yet) came out square */
  const img = picture ? (
    <img className="story-ring-photo" src={assetImage(picture)} alt={alt} width={size} height={size} />
  ) : (
    <span
      className="story-ring-inner story-ring-photo"
      style={{ width: size, height: size, display: 'block' }}
    />
  );

  if (!ring) {
    return onClick ? (
      <button type="button" onClick={onClick} title={title} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', lineHeight: 0 }}>
        {img}
      </button>
    ) : (
      img
    );
  }

  const className = `story-ring${seen ? ' seen' : ''}${onClick ? ' as-button' : ''}`;
  return onClick ? (
    <button type="button" className={className} onClick={onClick} title={title}>
      {img}
    </button>
  ) : (
    <span className={className}>{img}</span>
  );
}
