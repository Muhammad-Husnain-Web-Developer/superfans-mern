/**
 * The like/hate sounds the walls play, ported from the blade's own handlers
 * (user/world.blade.php:3552 and :3610): the coin on a like and the woosh on a hate, each
 * played on the toggle's response and for both directions — liking and un-liking alike.
 *
 * The blade holds them in <audio id="clickSound3"> / <audio id="clickSound5">; one element
 * per sound is enough here too, and play() on one already playing is a no-op in both apps,
 * so a burst of fast clicks makes a single sound.
 */

/* /assets/music is the Laravel public folder, served by the backend */
const sources = {
  like: '/assets/music/coin-sound.mp3',
  hate: '/assets/music/woosh-260275.mp3',
};

const elements: Partial<Record<keyof typeof sources, HTMLAudioElement>> = {};

function audio(name: keyof typeof sources) {
  let el = elements[name];
  if (!el) {
    el = new Audio(sources[name]);
    el.preload = 'auto';
    elements[name] = el;
  }
  return el;
}

function play(name: keyof typeof sources) {
  /* autoplay policy rejects this until the page has been interacted with; the blade lets the
     same failure pass silently rather than breaking the toggle it belongs to */
  void audio(name).play().catch(() => undefined);
}

/** blade clickSound3 — the coin, on like and unlike. */
export function playLikeSound() {
  play('like');
}

/** blade clickSound5 — the woosh, on hate and unhate. */
export function playHateSound() {
  play('hate');
}
