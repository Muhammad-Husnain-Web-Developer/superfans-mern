/**
 * The sounds the phone's sidebar plays when it opens and closes.
 *
 * The client sent two files — "open_nav" and "close" — for the left-edge tab the
 * client drew in nav-toggle.css. Both are gated by the same SOUND EFFECTS switch
 * the walls read (utils/soundEffects.ts), so the control panel's toggle silences
 * them the same way it silences the like and hate.
 *
 * Files live beside the like/hate recordings in public/sounds rather than in the
 * Laravel assets folder: that folder is not in git and only exists on the server,
 * so a file the frontend plays has to ship with the frontend.
 */
import { soundEffectsEnabled } from './soundEffects';

const sources = {
  open: '/sounds/obrir.mp3',
  /* the client's filename was close.MP3 — renamed lowercase to match the URL.
     Most filesystems in production are case-sensitive. */
  close: '/sounds/tancar.mp3',
};

const elements: Partial<Record<keyof typeof sources, HTMLAudioElement>> = {};

function audio(name: keyof typeof sources) {
  let el = elements[name];
  if (!el) {
    el = new Audio(sources[name]);
    el.preload = 'auto';
    /* ensure the file is loaded before play() is called — same reason postSounds
       carries the same line */
    el.load();
    elements[name] = el;
  }
  return el;
}

function play(name: keyof typeof sources) {
  if (!soundEffectsEnabled()) return;
  /* autoplay policy rejects this until the page has been interacted with; the
     tab's own tap is that interaction, so a rejected promise only ever happens
     on the very first paint, which never reaches here */
  void audio(name).play().catch(() => undefined);
}

export function playNavOpenSound() {
  play('open');
}

export function playNavCloseSound() {
  play('close');
}