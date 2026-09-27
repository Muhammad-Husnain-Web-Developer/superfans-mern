/**
 * The woosh the CONTROL PANEL plays as it opens.
 *
 * The client asked for it on the panel itself, not on the link that opens it, so it
 * is fired from the modal's own mount — every way in (the sidebar's control-panel
 * item, the phone footer, the profile page's own button) reaches the same three
 * modal components, so one call in each covers the lot and the sound lands with the
 * panel rather than ahead of it.
 *
 * Laravel has no sound here at all: the blades hold woosh-260275.mp3 as clickSound5
 * for the hate button only, and #exampleModalCenter / #userModalCenter open silently.
 * This is the client's own addition.
 *
 * Gated by the same SOUND EFFECTS switch as the nav and the like/hate (utils/soundEffects.ts) —
 * which is the switch that lives *inside* this panel, so turning it off and reopening
 * the panel is silent.
 */
import { soundEffectsEnabled } from './soundEffects';

/* the client's own file, shipped with the frontend rather than the Laravel asset folder:
   that folder is not in git and only exists on the server */
const WOOSH = '/sounds/woosh.mp3';

let element: HTMLAudioElement | undefined;

function audio() {
  if (!element) {
    element = new Audio(WOOSH);
    element.preload = 'auto';
    /* load up front — the same line postSounds and navSounds carry, against the
       intermittent failures that follow a suspended audio context */
    element.load();
  }
  return element;
}

/** Called on the control panel's mount. */
export function playModalOpenSound() {
  if (!soundEffectsEnabled()) return;
  const el = audio();
  /* a panel reopened before the last woosh finished starts over rather than being a
     no-op, which is what "on opening" should sound like */
  el.currentTime = 0;
  /* autoplay policy rejects this until the page has been interacted with; the tap that
     opened the panel is that interaction, so a rejection here is not worth surfacing */
  void el.play().catch(() => undefined);
}
