import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

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
          setUser(me);
          setLoading(false);
        }
      }),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => ({ user, loading, setUser }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
