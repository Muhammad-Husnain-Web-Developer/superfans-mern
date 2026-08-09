import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useStandalonePageStyles, BOOTSTRAP4_CDN } from '../../components/StandalonePage';

const NAV: [string, string][] = [
  ['/admin', 'Dashboard'],
  ['/admin/users', 'Users'],
  ['/admin/growth', 'Growth Engine'],
  ['/admin/orders', 'Orders'],
  ['/admin/models', 'Merch Models'],
  ['/admin/assets', 'Assets'],
  ['/admin/coupons', 'Coupons'],
  ['/admin/packages', 'Packages'],
];

/** Shared AdminLTE-style chrome for the admin panel: dark topbar + left nav + content. */
export function AdminShell({ title, children }: { title: string; children: ReactNode }) {
  useStandalonePageStyles([BOOTSTRAP4_CDN]);
  const { pathname } = useLocation();

  return (
    <div style={{ background: '#f4f6f9', minHeight: '100vh' }}>
      <div style={{ background: '#343a40', color: '#fff', padding: '14px 24px', fontSize: 20, fontWeight: 700, position: 'sticky', top: 0, zIndex: 20 }}>
        Superfans Admin
      </div>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <nav style={{ width: 220, background: '#3f474e', minHeight: 'calc(100vh - 52px)', padding: '12px 0', flexShrink: 0 }}>
          {NAV.map(([to, label]) => {
            const active = to === '/admin' ? pathname === '/admin' : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                style={{
                  display: 'block', padding: '11px 22px', color: active ? '#fff' : '#c2c7d0',
                  textDecoration: 'none', background: active ? '#007bff' : 'transparent', fontSize: 15,
                }}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <div style={{ flex: 1, padding: 24, minWidth: 0 }}>
          <h1 style={{ fontSize: 24, marginBottom: 18 }}>{title}</h1>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Simple modal used by the admin add/edit forms. */
export function AdminModal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 100000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 24, overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 8, width: '100%', maxWidth: 560, padding: 24, marginTop: 40 }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 style={{ margin: 0 }}>{title}</h4>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 24, cursor: 'pointer' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
