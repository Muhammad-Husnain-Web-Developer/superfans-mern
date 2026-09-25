import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { hydrateSoundEffects } from '../utils/soundEffects';

export type UserRole = 'user' | 'influencer' | 'business' | 'admin';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  usernameUrl: string | null;
  profilePicture: string | null;
  coverColor: string;
  verified: boolean;
  vip: boolean;
  chatToggle?: boolean;
  /* SOUND EFFECTS — the account-wide preference. Absent on older responses,
     treated as `true` (on) by the hydrator. */
  soundEffects?: boolean;
  createdAt?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  /** True while the initial /auth/me session check is running. */
  loading: boolean;
  setUser: (user: AuthUser | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void import('../api/auth').then(({ fetchMe }) =>
      fetchMe().then((me) => {
        if (!cancelled) {
          hydrateSoundEffects(me?.soundEffects);
          setUser(me);
          setLoading(false);
        }
      }),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  /* Every caller that swaps the viewer — login, logout, and the control panels'
     own setUser after a save — has to keep the sound cache in step, or the next
     click plays (or stays silent) against the previous account's preference.
     Wrapping here means no caller has to remember. */
  const setUserAndHydrate = useMemo(
    () => (next: AuthUser | null) => {
      hydrateSoundEffects(next?.soundEffects);
      setUser(next);
    },
    [],
  );

  const value = useMemo(
    () => ({ user, loading, setUser: setUserAndHydrate }),
    [user, loading, setUserAndHydrate],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}