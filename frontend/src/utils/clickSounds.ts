/**
 * The network slider's click sounds.
 *
 * Port of the inline script the blades ship next to every #slider_id
 * (influencer/world.blade.php:1262). Both arrows carry .play-sound2 and share
 * one counter: clicks play close.mp3 until the count reaches the current entry
 * of `pattern`, which plays Home-run-bat.mp3 instead and moves to the next
 * entry. With [4, 9] that reads as three clicks with the basic sound and the
 * fourth with the bat, then eight and the ninth, then four again — the cadence
 * the client describes.
 *
 * The <audio> elements are the blade's clickSound2 and clickSound4, and calling
 * play() on one already playing is a no-op there too, so a burst of fast clicks
 * makes a single sound in both apps.
 */
import { soundEffectsEnabled } from './soundEffects';
const pattern = [4, 9];
let patternIndex = 0;
let clickCount = 0;

/* /assets/music is the Laravel public folder, served by the backend */
const sources = {
  close: '/assets/music/close.mp3',
  bat: '/assets/music/Home-run-bat.mp3',
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

/** The blade's `.play-sound2` handler. */
export function playSliderClickSound() {
  /* SOUND EFFECTS: No — the arrows go silent, the counter holds its place so the
     cadence picks up where it left off if the switch is turned back on. */
  if (!soundEffectsEnabled()) return;
  clickCount++;
  let name: keyof typeof sources = 'close';
  if (clickCount >= pattern[patternIndex]) {
    name = 'bat';
    patternIndex = (patternIndex + 1) % pattern.length;
    clickCount = 0;
  }
  /* autoplay policy rejects the promise until the page has been interacted
     with; a click is that interaction, so this only guards the first paint */
  void audio(name)
    .play()
    .catch(() => {});
}
