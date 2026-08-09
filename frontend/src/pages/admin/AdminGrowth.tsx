import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { AdminShell } from './AdminShell';

interface GrowthUser {
  id: string; usernameUrl: string; name: string; role: string;
  noOfFollowers: number; verified: boolean; vip: boolean;
  growthStatus: string; growthGearLevel: number;
}

/**
 * Growth Engine console — port of influencer/all_users.blade.php (superuser tool):
 * per-user automatic-growth start/stop at a gear level, plus a manual "process" tick
 * (ports startAutomaticGrowth + processGrowth).
 */
export function AdminGrowth() {
  const [users, setUsers] = useState<GrowthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [gears, setGears] = useState<Record<string, number>>({});
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => { document.title = 'Admin | Growth Engine'; void load(); }, []);
  async function load() {
    const { data } = await api.get<{ users: GrowthUser[] }>('/admin/users');
    setUsers(data.users); setLoading(false);
  }

  async function toggle(u: GrowthUser) {
    const gear = gears[u.id] ?? u.growthGearLevel ?? 1;
    const { data } = await api.post<{ message: string }>(`/admin/growth/${u.id}`, { gear });
    setFlash(data.message);
    await load();
  }

  async function processNow() {
    const { data } = await api.post<{ message: string }>('/admin/growth/process/run');
    setFlash(data.message);
    await load();
  }

  const filtered = q ? users.filter((u) => (u.usernameUrl + u.name).toLowerCase().includes(q.toLowerCase())) : users;
  const activeCount = users.filter((u) => u.growthStatus === 'active').length;

  return (
    <AdminShell title="Growth Engine">
      {flash && <div className="alert alert-info">{flash}</div>}
      <div className="d-flex align-items-center mb-3" style={{ gap: 12, flexWrap: 'wrap' }}>
        <input className="form-control" style={{ maxWidth: 300 }} placeholder="Search users…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="badge badge-success" style={{ fontSize: 14 }}>{activeCount} active</span>
        <button className="btn btn-primary" onClick={processNow}>⚙️ Process Growth Now</button>
      </div>

      {loading ? <p>Loading…</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table className="table table-bordered table-sm bg-white">
            <thead className="thead-dark"><tr><th>Username</th><th>Followers</th><th>Growth</th><th>Gear</th><th>Action</th></tr></thead>
            <tbody>
              {filtered.slice(0, 200).map((u) => {
                const gear = gears[u.id] ?? u.growthGearLevel ?? 1;
                const active = u.growthStatus === 'active';
                return (
                  <tr key={u.id}>
                    <td>@{u.usernameUrl} {u.verified && '✔'} {u.vip && '⭐'}</td>
                    <td>{u.noOfFollowers.toLocaleString()}</td>
                    <td><span className={`badge badge-${active ? 'success' : 'secondary'}`}>{active ? `Active (Gear ${u.growthGearLevel})` : 'Inactive'}</span></td>
                    <td style={{ minWidth: 160 }}>
                      <input type="range" min={1} max={5} value={gear} disabled={active} onChange={(e) => setGears((s) => ({ ...s, [u.id]: Number(e.target.value) }))} style={{ width: 110 }} />
                      <small className="ml-2">Gear {gear}</small>
                    </td>
                    <td>
                      <button className={`btn btn-sm ${active ? 'btn-danger' : 'btn-success'}`} onClick={() => toggle(u)}>
                        {active ? 'Stop' : 'Start'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <small className="text-muted">{filtered.length} users</small>
        </div>
      )}
    </AdminShell>
  );
}
