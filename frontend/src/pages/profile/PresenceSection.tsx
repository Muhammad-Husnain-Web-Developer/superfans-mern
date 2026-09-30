import { useTranslation } from 'react-i18next';
import type { UserPresence } from '../../context/AuthContext';

/**
 * ESTADO — the control panel's presence picker.
 *
 * David, 30 Sep 2026: three buttons, a coloured dot on each, and the moment one is
 * pressed the account's dot changes everywhere. His mockup is the whole reference —
 * Laravel's control panel has no such block, so there is nothing to match against
 * and the shape follows the panel's own idiom instead: the live choice is the black
 * button, exactly as SOUND EFFECTS below it reads Yes/No.
 *
 * Shared by all three control panels (fan, influencer, and the world's userModalCenter)
 * so the block cannot drift between them.
 *
 * `onPick` saves; the caller owns that, because each panel saves through its own
 * `save()` and flash message.
 */
const OPTIONS: { value: UserPresence; colour: string; key: string }[] = [
  { value: 'online', colour: '#21c55d', key: 'presence_online' },
  { value: 'disconnected', colour: '#e5342b', key: 'presence_disconnected' },
  { value: 'away', colour: '#f5c518', key: 'presence_away' },
];

export function PresenceSection({
  value,
  onPick,
  H3,
}: {
  value: UserPresence;
  onPick: (next: UserPresence) => void;
  /** the panel's own heading style, passed in so the three panels stay identical */
  H3: React.CSSProperties;
}) {
  const { t: tUi } = useTranslation('ui');

  return (
    <>
      <h3 style={H3}>{tUi('presence_heading')}</h3>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          marginBottom: 18,
        }}
      >
        {OPTIONS.map((o) => {
          const live = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onPick(o.value)}
              aria-pressed={live}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 14px',
                // borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'bold',
                /* the live one is the black button, the way Yes/No reads under SOUND
                   EFFECTS — the panel already teaches the reader that black means on */
                background: live ? '#000' : '#fff',
                color: live ? '#fff' : 'red',
                transition: 'background-color 0.3s ease',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: o.colour,
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.25)',
                  flex: 'none',
                }}
              />
              {tUi(o.key)}
            </button>
          );
        })}
      </div>
    </>
  );
}
