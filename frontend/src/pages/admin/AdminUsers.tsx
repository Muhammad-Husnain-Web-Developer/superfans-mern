import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { AdminShell, AdminModal } from './AdminShell';

interface AdminUser {
  id: string; name: string; usernameUrl: string; email: string; role: string;
  status: string; verified: boolean; vip: boolean; noOfFollowers: number; earnings: number; videoAdsEarnings: number;
}

/** the blade prints earnings as a plain 2-decimal figure; the table follows it */
const money = (n: number) => `$${(Math.round(n * 100) / 100).toFixed(2)}`;

/** Admin Users — port of admin/users.blade.php + edit_user.blade.php (list / edit / delete). */
export function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => { document.title = 'Admin | Users'; void load(); }, []);
  async function load() {
    const { data } = await api.get<{ users: AdminUser[] }>('/admin/users');
    setUsers(data.users); setLoading(false);
  }
  async function del(u: AdminUser) {
    if (!window.confirm(`Delete ${u.usernameUrl}?`)) return;
    await api.delete(`/admin/users/${u.id}`); await load();
  }

  const filtered = q ? users.filter((u) => (u.usernameUrl + u.email + u.name).toLowerCase().includes(q.toLowerCase())) : users;

  return (
    <AdminShell title="Users">
      <input className="form-control mb-3" style={{ maxWidth: 320 }} placeholder="Search users…" value={q} onChange={(e) => setQ(e.target.value)} />
      {loading ? <p>Loading…</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table className="table table-bordered table-sm bg-white">
            <thead className="thead-dark"><tr><th>Username</th><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Verified</th><th>VIP</th><th>Followers</th><th>Earnings</th><th>Video Ads</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.slice(0, 300).map((u) => (
                <tr key={u.id}>
                  <td>@{u.usernameUrl}</td><td>{u.name}</td><td>{u.email}</td><td>{u.role}</td>
                  <td><span className={`badge badge-${u.status === 'active' ? 'success' : 'secondary'}`}>{u.status}</span></td>
                  <td>{u.verified ? '✔' : '—'}</td><td>{u.vip ? '✔' : '—'}</td><td>{u.noOfFollowers.toLocaleString()}</td>
                  <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{money(u.earnings)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{money(u.videoAdsEarnings)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn btn-sm btn-success mr-1" onClick={() => setEditing(u)}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={() => del(u)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <small className="text-muted">{filtered.length} users</small>
        </div>
      )}

      {editing && <EditUser user={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} />}
    </AdminShell>
  );
}

function EditUser({ user, onClose, onSaved }: { user: AdminUser; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: user.name, email: user.email, usernameUrl: user.usernameUrl, role: user.role, status: user.status, verified: user.verified, vip: user.vip });
  /* kept out of `f` because it is typed and must go over as a number, not the string an
     input hands back — the endpoint takes z.number() */
  const [earnings, setEarnings] = useState(String(user.earnings ?? 0));
  const [videoAds, setVideoAds] = useState(String(user.videoAdsEarnings ?? 0));
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const amount = Number(earnings);
    const video = Number(videoAds);
    try {
      await api.put(`/admin/users/${user.id}`, {
        ...f,
        ...(Number.isFinite(amount) && amount >= 0 ? { earnings: amount } : {}),
        ...(Number.isFinite(video) && video >= 0 ? { videoAdsEarnings: video } : {}),
      });
      onSaved();
    } finally { setBusy(false); }
  }
  return (
    <AdminModal title={`Edit @${user.usernameUrl}`} onClose={onClose}>
      <form onSubmit={save}>
        <div className="form-group"><label>Name</label><input className="form-control" value={f.name} onChange={(e) => set('name', e.target.value)} /></div>
        <div className="form-group"><label>Username</label><input className="form-control" value={f.usernameUrl} onChange={(e) => set('usernameUrl', e.target.value)} /></div>
        <div className="form-group"><label>Email</label><input className="form-control" value={f.email} onChange={(e) => set('email', e.target.value)} /></div>
        <div className="form-row">
          <div className="form-group col"><label>Role</label>
            <select className="form-control" value={f.role} onChange={(e) => set('role', e.target.value)}>
              {['user', 'influencer', 'business', 'admin'].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="form-group col"><label>Status</label>
            <select className="form-control" value={f.status} onChange={(e) => set('status', e.target.value)}>
              {['active', 'suspended'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="form-check"><input type="checkbox" className="form-check-input" id="ev" checked={f.verified} onChange={(e) => set('verified', e.target.checked)} /><label className="form-check-label" htmlFor="ev">Verified</label></div>
        <div className="form-check mb-3"><input type="checkbox" className="form-check-input" id="vp" checked={f.vip} onChange={(e) => set('vip', e.target.checked)} /><label className="form-check-label" htmlFor="vp">VIP</label></div>
        {/* One figure per user, as in Laravel: `users.earnings` is the total and
            earnings_logs only records what each payment was for. Video Ads has no bucket
            of its own, so this is where the client sets it. */}
        <div className="form-group">
          <label>Earnings (total, $)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="form-control"
            value={earnings}
            onChange={(e) => setEarnings(e.target.value)}
          />
          <small className="text-muted">Set by hand — subscriptions, video ads and the rest all add up here.</small>
        </div>
        {/* the breakdown the client asked to show in the creator's control panel */}
        <div className="form-group">
          <label>Video Ads Earnings ($)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="form-control"
            value={videoAds}
            onChange={(e) => setVideoAds(e.target.value)}
          />
          <small className="text-muted">Shown on its own line in the creator's control panel.</small>
        </div>
        <button className="btn btn-primary" disabled={busy}>Save</button>
      </form>
    </AdminModal>
  );
}
