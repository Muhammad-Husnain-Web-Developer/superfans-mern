import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { UserPresence } from '../context/AuthContext';
import { onPresenceChange } from '../utils/presence';

/**
 * ESTADO — the coloured dot beside an @nickname.
 *
 * The client's own feature (30 Sep 2026); Laravel has nothing like it, so there is no
 * blade to match here and the colours are the ones he drew: green online, red
 * disconnected, yellow away.
 *
 * It listens for itself. A dot is rendered in a dozen places — the profile sidebar,
 * the posts wall, whatever comes next — and the alternative was for each of those to
 * subscribe, hold state and pass it down. Instead every dot watches the one socket
 * event for its own user id, so a status change reaches all of them at once and a
 * caller only has to say whose dot this is.
 *
 * `presence` is the value the page was loaded with; the socket overrides it from there.
 */
const COLOURS: Record<UserPresence, string> = {
  online: '#21c55d',
  disconnected: '#e5342b',
  away: '#f5c518',
};

const LABEL_KEYS: Record<UserPresence, string> = {
  online: 'presence_online',
  disconnected: 'presence_disconnected',
  away: 'presence_away',
};

export function PresenceDot({
  userId,
  presence = 'online',
  size = 10,
  style,
}: {
  /** whose dot this is — the id the socket event is matched against */
  userId: string | null | undefined;
  presence?: UserPresence;
  size?: number;
  style?: React.CSSProperties;
}) {
  const { t: tUi } = useTranslation('ui');
  const [live, setLive] = useState<UserPresence>(presence);
  const [seenProp, setSeenProp] = useState<UserPresence>(presence);

  /* A page often mounts its dots before the profile has loaded, so the prop arrives
     after the first render and has to replace what the socket has (or has not) said.
     Adjusted during render against the last prop seen rather than in an effect: an
     effect would paint the stale colour first and then correct it, and React warns
     about the cascade. https://react.dev/learn/you-might-not-need-an-effect */
  if (seenProp !== presence) {
    setSeenProp(presence);
    setLive(presence);
  }

  useEffect(() => {
    if (!userId) return;
    return onPresenceChange((id, next) => {
      if (id === userId) setLive(next);
    });
  }, [userId]);

  const label = tUi(LABEL_KEYS[live]);

  return (
    <span
      title={label}
      aria-label={label}
      role="img"
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: COLOURS[live],
        /* the dot sits on photos and on white alike, so it carries its own edge */
        boxShadow: '0 0 0 1px rgba(0,0,0,0.25)',
        flex: 'none',
        ...style,
      }}
    />
  );
}
