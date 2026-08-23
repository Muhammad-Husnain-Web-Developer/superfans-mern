/**
 * How a chosen text colour paints the story's text box.
 *
 * The four bright colours are ink on the box's white field, the way the mockup draws them.
 * The two neutrals at the top of the palette are the field itself: white gives a white box
 * with black words, black a black box with white ones — the client's rule, and the only way
 * white is legible at all, since white ink on the white field was invisible.
 */
export function storyTextStyle(colour?: string | null): { background?: string; color: string } {
  switch ((colour ?? '').toLowerCase()) {
    case '#ffffff':
      return { background: '#ffffff', color: '#000000' };
    case '#000000':
      return { background: '#000000', color: '#ffffff' };
    default:
      return { color: colour || '#000000' };
  }
}

/** true while the colour paints the box rather than the words. */
export function isFieldColour(colour?: string | null): boolean {
  const c = (colour ?? '').toLowerCase();
  return c === '#ffffff' || c === '#000000';
}
