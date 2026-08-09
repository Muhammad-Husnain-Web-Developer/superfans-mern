import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { AdminShell, AdminModal } from './AdminShell';

interface Coupon {
  id: string; name: string; code: string; amount: number; type: string; expiryDate: string; limitOne: number;
}

/** Admin Coupons — port of admin/coupons + add_coupon + edit_coupon blades. */
export function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Coupon | 'new' | null>(null);

  useEffect(() => { document.title = 'Admin | Coupons'; void load(); }, []);
  async function load() {
    const { data } = await api.get<{ coupons: Coupon[] }>('/admin/coupons');
    setCoupons(data.coupons); setLoading(false);
  }
  async function del(c: Coupon) {
    if (!window.confirm(`Delete coupon ${c.code}?`)) return;
    await api.delete(`/admin/coupons/${c.id}`); await load();
  }

  return (
    <AdminShell title="Coupons">
      <button className="btn btn-primary mb-3" onClick={() => setEditing('new')}>+ Add Coupon</button>
      {loading ? <p>Loading…</p> : coupons.length === 0 ? <p className="text-muted">No coupons yet.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table className="table table-bordered bg-white">
            <thead className="thead-dark"><tr><th>Name</th><th>Code</th><th>Amount</th><th>Type</th><th>Expiry</th><th>One-time</th><th>Actions</th></tr></thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td><td><code>{c.code}</code></td><td>{c.amount}</td><td>{c.type}</td><td>{c.expiryDate || '—'}</td><td>{c.limitOne ? 'Yes' : 'No'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn btn-sm btn-success mr-1" onClick={() => setEditing(c)}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={() => del(c)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <CouponForm coupon={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} />}
    </AdminShell>
  );
}

function CouponForm({ coupon, onClose, onSaved }: { coupon: Coupon | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    name: coupon?.name ?? '', code: coupon?.code ?? '', amount: String(coupon?.amount ?? ''),
    type: coupon?.type || 'percentage', expiry_date: coupon?.expiryDate ?? '', limit_one: coupon?.limitOne ? 1 : 0,
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string | number) => setF((s) => ({ ...s, [k]: v }));
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      if (coupon) await api.put(`/admin/coupons/${coupon.id}`, f);
      else await api.post('/admin/coupons', f);
      onSaved();
    } finally { setBusy(false); }
  }
  return (
    <AdminModal title={coupon ? 'Edit Coupon' : 'Add Coupon'} onClose={onClose}>
      <form onSubmit={save}>
        <div className="form-group"><label>Name</label><input className="form-control" value={f.name} onChange={(e) => set('name', e.target.value)} /></div>
        <div className="form-group"><label>Code</label><input className="form-control" value={f.code} onChange={(e) => set('code', e.target.value)} required /></div>
        <div className="form-row">
          <div className="form-group col"><label>Amount</label><input type="number" className="form-control" value={f.amount} onChange={(e) => set('amount', e.target.value)} required /></div>
          <div className="form-group col"><label>Type</label>
            <select className="form-control" value={f.type} onChange={(e) => set('type', e.target.value)}>
              <option value="percentage">percentage</option><option value="fixed">fixed</option>
            </select>
          </div>
        </div>
        <div className="form-group"><label>Expiry date</label><input type="date" className="form-control" value={f.expiry_date} onChange={(e) => set('expiry_date', e.target.value)} /></div>
        <div className="form-check mb-3"><input type="checkbox" className="form-check-input" id="lo" checked={!!f.limit_one} onChange={(e) => set('limit_one', e.target.checked ? 1 : 0)} /><label className="form-check-label" htmlFor="lo">Limit one per user</label></div>
        <button className="btn btn-primary" disabled={busy}>Save</button>
      </form>
    </AdminModal>
  );
}
