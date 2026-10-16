/**
 * A nickname in a URL matches its owner whatever the capitals.
 *
 * David, 16 Oct 2026: "make the CAPS letters don't take issue in URL … if they tag @tepazai
 * will not take 404". Laravel never had the problem — MySQL's utf8mb4_unicode_ci compares
 * `username_url` without case, so /tepazai opened @TepazAI there. MongoDB compares exactly, so
 * the port answered 404 for any spelling but the stored one (3 319 of the migrated nicknames
 * carry a capital). The stored nickname keeps its capitals for display; only matching ignores
 * them — and so does "is this nickname taken?", so two accounts can never differ by case alone
 * and a URL always names one profile.
 */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** `{ usernameUrl: usernameUrlMatch(x) }` — the whole nickname, any capitals. */
export function usernameUrlMatch(raw: string): { $regex: string; $options: 'i' } {
  return { $regex: `^${escapeRegex(raw.trim())}$`, $options: 'i' };
}
