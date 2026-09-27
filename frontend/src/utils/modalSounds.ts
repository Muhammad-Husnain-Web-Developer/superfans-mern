/**
 * The sounds a modal plays as it opens — the control panel's woosh, and the stars
 * the client asked for on the subscription chain (29 Sep 2026).
 *
 * The client asked for these on the panel itself, not on the link that opens it, so
 * each is fired as the modal appears — every way in (the sidebar's control-panel item,
 * the phone footer, the profile page's own button) reaches the same modal components,
 * so one call in each covers the lot and the sound lands with the panel rather than
 * ahead of it.
 *
 * Laravel has no sound here at all: the blades hold woosh-260275.mp3 as clickSound5
 * for the hate button only, and #exampleModalCenter / #userModalCenter / #register_Modal
 * open silently. These are the client's own addition.
 *
 * Gated by the same SOUND EFFECTS switch as the nav and the like/hate (utils/soundEffects.ts) —
 * which is the switch that lives *inside* the control panel, so turning it off and
 * reopening a panel is silent. A guest has no account to read it from and the flag
 * defaults to on, which is what the subscription chain needs: it is a guest modal.
 */
import { soundEffectsEnabled } from './soundEffects';

/* the client's own files, shipped with the frontend rather than the Laravel asset
   folder: that folder is not in git and only exists on the server. The doubled
   `.mp3.mpeg` is how he sends them and prod is case-sensitive — do not tidy it. */
const WOOSH = '/sounds/woosh.mp3';
const STARS = '/sounds/stars_effect_subscription.mp3.mpeg';

/** One lazily-built <audio> per file, reused for every play. */
function cue(src: string) {
  let element: HTMLAudioElement | undefined;
  return function play() {
    if (!soundEffectsEnabled()) return;
    if (!element) {
      element = new Audio(src);
      element.preload = 'auto';
      /* load up front — the same line postSounds and navSounds carry, against the
         intermittent failures that follow a suspended audio context */
      element.load();
    }
    /* a modal reopened before the last cue finished starts over rather than being a
       no-op, which is what "on opening" should sound like */
    element.currentTime = 0;
    /* autoplay policy rejects this until the page has been interacted with; the tap that
       opened the modal is that interaction, so a rejection here is not worth surfacing */
    void element.play().catch(() => undefined);
  };
}

/** Called on the control panel's mount. */
export const playModalOpenSound = cue(WOOSH);

/**
 * Called as the subscribe modal mounts and as the guest "create your account first"
 * chooser opens — the two the client named. Not the plain login modal: that one is
 * the bottom bar's Login button, a different door.
 */
export const playSubscriptionSound = cue(STARS);
