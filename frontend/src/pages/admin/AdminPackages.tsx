import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { AdminShell, AdminModal } from './AdminShell';

interface Package { id: string; name: string; price: number; desc: string; duration: number; durationUnit: string; }
interface Includes { available: string; unlimited: string; twentyFourHourFree: string; free: string; }

/** Admin Packages — port of admin/packages + edit_package blades. */
export function AdminPackages() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Package | null>(null);

  useEffect(() => { document.title = 'Admin | Packages'; void load(); }, []);
  async function load() {
    const { data } = await api.get<{ packages: Package[] }>('/admin/packages');
    setPackages(data.packages); setLoading(false);
  }

  return (
    <AdminShell title="Packages">
      {loading ? <p>Loading…</p> : packages.length === 0 ? <p className="text-muted">No packages defined.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table className="table table-bordered bg-white">
            <thead className="thead-dark"><tr><th>Name</th><th>Price</th><th>Duration</th><th>Description</th><th>Actions</th></tr></thead>
            <tbody>
              {packages.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td><td>€{p.price}</td><td>{p.duration} {p.durationUnit}</td><td>{p.desc}</td>
                  <td><button className="btn btn-sm btn-success" onClick={() => setEditing(p)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <PackageForm pkg={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} />}
    </AdminShell>
  );
}

function PackageForm({ pkg, onClose, onSaved }: { pkg: Package; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: pkg.name, price: String(pkg.price), desc: pkg.desc, duration: String(pkg.duration), duration_unit: pkg.durationUnit });
  const [inc, setInc] = useState<Includes>({ available: '', unlimited: '', twentyFourHourFree: '', free: '' });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    api.get<{ includes: Includes | null }>(`/admin/packages/${pkg.id}`).then(({ data }) => data.includes && setInc(data.includes));
  }, [pkg.id]);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      await api.put(`/admin/packages/${pkg.id}`, {
        ...f, available: inc.available, unlimited: inc.unlimited, twenty_four_hour_free: inc.twentyFourHourFree, free: inc.free,
      });
      onSaved();
    } finally { setBusy(false); }
  }
  return (
    <AdminModal title="Edit Package" onClose={onClose}>
      <form onSubmit={save}>
        <div className="form-group"><label>Name</label><input className="form-control" value={f.name} onChange={(e) => set('name', e.target.value)} /></div>
        <div className="form-row">
          <div className="form-group col"><label>Price (€)</label><input type="number" className="form-control" value={f.price} onChange={(e) => set('price', e.target.value)} /></div>
          <div className="form-group col"><label>Duration</label><input type="number" className="form-control" value={f.duration} onChange={(e) => set('duration', e.target.value)} /></div>
          <div className="form-group col"><label>Unit</label><input className="form-control" value={f.duration_unit} onChange={(e) => set('duration_unit', e.target.value)} /></div>
        </div>
        <div className="form-group"><label>Description</label><textarea className="form-control" value={f.desc} onChange={(e) => set('desc', e.target.value)} /></div>
        <hr /><b>Includes</b>
        <div className="form-group"><label>Available</label><input className="form-control" value={inc.available} onChange={(e) => setInc((s) => ({ ...s, available: e.target.value }))} /></div>
        <div className="form-group"><label>Unlimited</label><input className="form-control" value={inc.unlimited} onChange={(e) => setInc((s) => ({ ...s, unlimited: e.target.value }))} /></div>
        <div className="form-group"><label>24h Free</label><input className="form-control" value={inc.twentyFourHourFree} onChange={(e) => setInc((s) => ({ ...s, twentyFourHourFree: e.target.value }))} /></div>
        <div className="form-group"><label>Free</label><input className="form-control" value={inc.free} onChange={(e) => setInc((s) => ({ ...s, free: e.target.value }))} /></div>
        <button className="btn btn-primary" disabled={busy}>Save</button>
      </form>
    </AdminModal>
  );
}
