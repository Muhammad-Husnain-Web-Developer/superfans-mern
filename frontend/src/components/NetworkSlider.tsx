import { useRef, useState, type CSSProperties } from 'react';
import { assetImage } from '../utils/format';
import '../styles/network-slider.css';

export interface NetworkSlide {
  name: string;
  href: string;
  /** file name under /assets/images */
  img: string;
}

/**
 * The sidebar's social-network slider (#slider_id).
 *
 * Shared by the world sidebar and the profile sidebar, which carried two copies
 * of the same markup. One item is on screen at a time; paging re-keys it so the
 * new logo animates in from the side the arrow points at.
 */
export function NetworkSlider({
  items,
  style,
  soundClass = '',
}: {
  items: NetworkSlide[];
  style?: CSSProperties;
  /** the profile sidebar's arrows carry play-sound2 */
  soundClass?: string;
}) {
  const [index, setIndex] = useState(0);
  const direction = useRef<'next' | 'prev'>('next');

  if (items.length === 0) return null;
  const current = items[((index % items.length) + items.length) % items.length];

  const page = (dir: 'next' | 'prev') => {
    direction.current = dir;
    setIndex((i) => (dir === 'next' ? i + 1 : i - 1));
  };

  return (
    <div
      id="slider_id"
      className="slider network-slider"
      style={{ width: '100%', margin: 0, height: 120, boxShadow: 'none', ...style }}
    >
      <div className={`slider-control next ${soundClass}`.trim()} onClick={() => page('next')}>
        <i className="fa fa-angle-right" aria-hidden="true" style={{ color: '#060605' }}></i>
      </div>
      <div className={`slider-control prev ${soundClass}`.trim()} onClick={() => page('prev')}>
        <i className="fa fa-angle-left" aria-hidden="true" style={{ color: '#060605' }}></i>
      </div>
      {/* keyed on the index so React remounts it and the entry animation replays */}
      <div key={index} className={`item active network-slide-${direction.current}`}>
        <div className="item-content">
          <a href={current.href}>
            <span className="network-slider-icon">
              <img src={assetImage(current.img)} alt="" />
            </span>
            <span className="network-slider-label">
              <b>{current.name}</b>
            </span>
          </a>
        </div>
      </div>
    </div>
  );
}
