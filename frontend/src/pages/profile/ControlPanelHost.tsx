import { useEffect, useState } from 'react';
import { fetchProfile, type ProfileData } from '../../api/profiles';
import { useAuth } from '../../context/AuthContext';
import { UserModalCenter } from './UserModalCenter';
import { InfluencerControlPanelModal } from './InfluencerControlPanelModal';

/**
 * Opens the viewer's own control panel from the layouts.main pages (world, influencers,
 * feed): it fetches the profile on demand, then renders the creator modal or the fuller
 * fan modal (#userModalCenter, with cover-colour/gender/birth/country/verified), which is
 * the one Laravel shows on those pages.
 */
export function ControlPanelHost({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user: authUser } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);

  useEffect(() => {
    if (!open || !authUser?.usernameUrl) return;
    let cancelled = false;
    fetchProfile(authUser.usernameUrl)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, authUser?.usernameUrl]);

  if (!open || !profile) return null;

  const reload = () => {
    if (authUser?.usernameUrl) void fetchProfile(authUser.usernameUrl).then(setProfile);
  };

  return authUser?.role === 'influencer' ? (
    <InfluencerControlPanelModal profile={profile} onClose={onClose} onSaved={reload} />
  ) : (
    <UserModalCenter profile={profile} onClose={onClose} onSaved={reload} />
  );
}
