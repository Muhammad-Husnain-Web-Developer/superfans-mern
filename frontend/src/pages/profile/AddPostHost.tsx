import { useCallback, useEffect, useState } from 'react';
import { fetchProfilePosts, type ProfilePost } from '../../api/profiles';
import { useAuth } from '../../context/AuthContext';
import { AddPostModal } from './AddPostModal';

/**
 * Opens #add_post_modal from the layouts.main pages (world, feed, influencers),
 * which carry the same modal as the wall but have no posts of their own to hand
 * it — the blade's controller loads them with the page. Fetched on demand here,
 * the same way ControlPanelHost fetches the profile.
 */
export function AddPostHost({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user: authUser } = useAuth();
  const [posts, setPosts] = useState<ProfilePost[] | null>(null);

  const load = useCallback(() => {
    if (!authUser?.usernameUrl) return;
    fetchProfilePosts(authUser.usernameUrl)
      .then(setPosts)
      .catch(() => setPosts([]));
  }, [authUser?.usernameUrl]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  if (!open || !posts) return null;

  return <AddPostModal myPosts={posts} onClose={onClose} onChanged={load} />;
}
