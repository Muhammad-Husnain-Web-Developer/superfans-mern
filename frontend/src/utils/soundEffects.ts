/**
 * The SOUND EFFECTS flag, held in memory and mirrored on the account.
 *
 * The preference lives on the user document (users.soundEffects, default true),
 * so it is the same on every device and cannot be cleared by opening DevTools.
 * The value is read from the account when /auth/me answers, and written back on
 * every toggle.
 *
 * Functions here stay synchronous — every caller already expects a boolean back
 * with no await — so the API write is fired and forgotten, and the local value
 * is what everything reads in the meantime. If the write fails, the flag flips
 * back the next time /auth/me lands, which is the honest answer.
 */
let current = true;

/** Called once, from AuthContext, whenever the logged-in user changes. */
export function hydrateSoundEffects(value: boolean | undefined): void {
  /* `value !== false` rather than `value ?? true`: an account with no stored
     preference (created before the field existed) answers `undefined` and must
     read as on, which is what the client asked for. */
  current = value !== false;
}

export function soundEffectsEnabled(): boolean {
  return current;
}

export function setSoundEffectsEnabled(on: boolean): void {
  current = on;
  /* fire and forget — the caller is a button click, not a modal that should wait */
  void import('../api/client').then(({ api }) =>
    api.patch('/me/settings', { soundEffects: on }).catch(() => {}),
  );
}