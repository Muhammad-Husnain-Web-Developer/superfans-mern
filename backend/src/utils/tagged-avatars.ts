import { User } from '../models/User.js';
import { escapeRegex } from './username.js';

interface TaggedPost {
  tags?: string[] | null;
  taggedProfilePictures?: string[] | null;
}

/**
 * Fills in the avatar for every tagged handle a post is missing one for.
 *
 * `taggedProfilePictures` is a snapshot taken when the post was written, and it
 * runs short — of the posts carrying a tag, roughly two in five have no picture
 * stored at all. The blade hides a handle in that case (user/index.blade.php:1690
 * requires both), which is why those tags never appeared. The tagged accounts do
 * exist, so their current avatar is looked up instead and the handle shows either
 * way.
 *
 * Returns one array per post, aligned to that post's `tags`, with an empty string
 * where no avatar could be resolved.
 */
export async function resolveTaggedAvatars(posts: TaggedPost[]): Promise<string[][]> {
  const unresolved = new Set<string>();
  for (const post of posts) {
    (post.tags ?? []).forEach((tag, i) => {
      const name = (tag ?? '').trim();
      const stored = (post.taggedProfilePictures ?? [])[i]?.trim();
      if (name && !stored) unresolved.add(name);
    });
  }

  const avatars = new Map<string, string>();
  if (unresolved.size > 0) {
    /* a tag written @tepazai still finds @TepazAI — nicknames match without case (utils/username) */
    const users = await User.find({
      usernameUrl: { $in: [...unresolved].map((n) => new RegExp(`^${escapeRegex(n)}$`, 'i')) },
    })
      .select('usernameUrl profilePicture')
      .lean();
    for (const user of users) {
      if (user.usernameUrl && user.profilePicture) avatars.set(user.usernameUrl.toLowerCase(), user.profilePicture);
    }
  }

  return posts.map((post) =>
    (post.tags ?? []).map((tag, i) => {
      const name = (tag ?? '').trim();
      const stored = (post.taggedProfilePictures ?? [])[i]?.trim();
      return stored || (name ? avatars.get(name.toLowerCase()) ?? '' : '');
    }),
  );
}
