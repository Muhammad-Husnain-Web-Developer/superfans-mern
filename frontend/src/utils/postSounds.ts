/**
 * The like/hate sounds the walls play, ported from the blade's own handlers
 * (user/world.blade.php:3552 and :3610): the coin on a like and the woosh on a hate, each
 * played on the toggle's response and for both directions — liking and un-liking alike.
 *
 * The blade holds them in <audio id="clickSound3"> / <audio id="clickSound5">; one element
 * per sound is enough here too, and play() on one already playing is a no-op in both apps,
 * so a burst of fast clicks makes a single sound.
 */

/* The client's own recordings, shipped with the frontend rather than the Laravel asset
   folder — that folder is not in git and only exists on the server. */
const sources = {
  cor11: '/sounds/cor11.mp3',
  cor22: '/sounds/cor22.mp3',
  hate: '/sounds/caca11.mp3',
};

/**
 * The like sound is not one sound but a run of eleven, given by the client in this order and
 * repeated from the top: two of cor22 then cor11, twice over, then two more of cor22 and
 * three of cor11 to close. It works the way the socials slider's arrows already do — one
 * counter, walked on every click, so the run carries across posts rather than restarting.
 */
const LIKE_RUN = [
  'cor22', 'cor22', 'cor11',
  'cor22', 'cor22', 'cor11',
  'cor22', 'cor22', 'cor11',
  'cor11', 'cor11',
] as const;
let likeStep = 0;

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

/** The next sound in the client's run, on like and unlike alike. */
export function playLikeSound() {
  play(LIKE_RUN[likeStep]);
  likeStep = (likeStep + 1) % LIKE_RUN.length;
}

/** caca11 — on hate and unhate. */
export function playHateSound() {
  play('hate');
}
