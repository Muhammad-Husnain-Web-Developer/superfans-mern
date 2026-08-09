import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { api } from '../../api/client';
import { AdminShell } from './AdminShell';

interface Stats {
  sales: number;
  users: number;
  subscriptions: number;
}

/** Admin dashboard — port of AdminController@index: Sales / Users / Subscriptions stat cards. */
export function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Superfans | Admin';
    api
      .get<{ stats: Stats }>('/admin/stats')
      .then(({ data }) => setStats(data.stats))
      .catch((e) => setError(isAxiosError(e) && e.response?.status === 403 ? 'Admin access only.' : 'Could not load stats.'));
  }, []);

  const cards: [string, keyof Stats, string, string][] = [
    ['Sales', 'sales', '#17a2b8', '🛍️'],
    ['Users', 'users', '#28a745', '📊'],
    ['Subscriptions', 'subscriptions', '#dc3545', '📈'],
  ];

  return (
    <AdminShell title="Dashboard">
      {error ? (
        <div className="alert alert-warning">{error}</div>
      ) : !stats ? (
        <p>Loading…</p>
      ) : (
        <div className="row">
          {cards.map(([label, key, color, icon]) => (
            <div className="col-lg-4 col-6" key={key}>
              <div style={{ borderRadius: 6, position: 'relative', marginBottom: 20, color: '#fff', overflow: 'hidden', background: color, boxShadow: '0 1px 3px rgba(0,0,0,.2)' }}>
                <div style={{ padding: '12px 16px' }}>
                  <h3 style={{ fontSize: 38, fontWeight: 700, margin: 0 }}>{stats[key].toLocaleString()}</h3>
                  <p style={{ fontSize: 15, margin: 0 }}>{label}</p>
                </div>
                <div style={{ position: 'absolute', top: 6, right: 14, fontSize: 58, opacity: 0.25 }}>{icon}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
