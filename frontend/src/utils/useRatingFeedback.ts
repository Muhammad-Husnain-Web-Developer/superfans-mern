import { useCallback, useState } from 'react';
import { playHateSound, playLikeSound } from './postSounds';

/**
 * The click feedback the blade fires from its toggle response: the coin plus a beating heart
 * on a like, the woosh plus a bouncing poop on a hate — both ways round, liking and undoing
 * it alike. The card calls onLiked/onHated once the request has answered, so nothing sounds
 * when the toggle fails or a guest is sent to the register modal instead.
 */
export function useRatingFeedback() {
  const [beat, setBeat] = useState(false);
  const [bounce, setBounce] = useState(false);

  const onLiked = useCallback(() => {
    playLikeSound();
    setBeat(true);
    setTimeout(() => setBeat(false), 600);
  }, []);

  const onHated = useCallback(() => {
    playHateSound();
    setBounce(true);
    setTimeout(() => setBounce(false), 600);
  }, []);

  return { beat, bounce, onLiked, onHated };
}
