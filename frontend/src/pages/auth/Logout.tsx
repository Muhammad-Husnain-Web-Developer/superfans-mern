import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { logout as apiLogout } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';

/**
 * /logout — port of HomeController@logout (+ BuisnessController@logout):
 * clears the session and redirects to /login, or /business/login for business
 * accounts. Rendered as a route because the blade links to it with a plain <a>.
 */
export function Logout() {
  const { user, loading, setUser } = useAuth();
  const [done, setDone] = useState(false);
  const target = useRef('/login');
  const started = useRef(false);

  useEffect(() => {
    if (loading || started.current) return;
    started.current = true;
    if (user?.role === 'business') target.current = '/business/login';
    void apiLogout()
      .catch(() => undefined)
      .finally(() => {
        setUser(null);
        setDone(true);
      });
  }, [loading, user, setUser]);

  if (!done) return null;
  return <Navigate to={target.current} replace />;
}
