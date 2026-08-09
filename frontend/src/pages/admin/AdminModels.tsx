import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { assetImage } from '../../utils/format';
import { AdminShell, AdminModal } from './AdminShell';

interface Modal {
  id: string; name: string; price: number; icon: string | null; image: string | null;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(file); });
}

/** Admin Merch Models — port of admin/models + add_model + edit_modal blades. */
export function AdminModels() {
  const [models, setModels] = useState<Modal[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Modal | 'new' | null>(null);

  useEffect(() => { document.title = 'Admin | Merch Models'; void load(); }, []);
  async function load() {
    const { data } = await api.get<{ models: Modal[] }>('/admin/models');
    setModels(data.models); setLoading(false);
  }
  async function del(m: Modal) {
    if (!window.confirm(`Delete ${m.name}?`)) return;
    await api.delete(`/admin/models/${m.id}`); await load();
  }

  return (
    <AdminShell title="Merch Models">
      <button className="btn btn-primary mb-3" onClick={() => setEditing('new')}>+ Add Model</button>
      {loading ? <p>Loading…</p> : models.length === 0 ? <p className="text-muted">No models yet.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table className="table table-bordered bg-white">
            <thead className="thead-dark"><tr><th>Image</th><th>Name</th><th>Price</th><th>Actions</th></tr></thead>
            <tbody>
              {models.map((m) => (
                <tr key={m.id}>
                  <td>{m.image ? <img src={assetImage(m.image)} alt="" width={70} /> : '—'}</td>
                  <td>{m.name}</td><td>€{m.price}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn btn-sm btn-success mr-1" onClick={() => setEditing(m)}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={() => del(m)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <ModelForm model={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} />}
    </AdminShell>
  );
}

function ModelForm({ model, onClose, onSaved }: { model: Modal | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(model?.name ?? '');
  const [price, setPrice] = useState(String(model?.price ?? ''));
  const [icon, setIcon] = useState('');
  const [image, setImage] = useState('');
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const body: Record<string, unknown> = { name, price };
    if (icon) body.icon = icon;
    if (image) body.image = image;
    try {
      if (model) await api.put(`/admin/models/${model.id}`, body);
      else await api.post('/admin/models', body);
      onSaved();
    } finally { setBusy(false); }
  }
  return (
    <AdminModal title={model ? 'Edit Model' : 'Add Model'} onClose={onClose}>
      <form onSubmit={save}>
        <div className="form-group"><label>Name</label><input className="form-control" value={name} onChange={(e) => setName(e.target.value)} required /></div>
        <div className="form-group"><label>Price (€)</label><input type="number" className="form-control" value={price} onChange={(e) => setPrice(e.target.value)} required /></div>
        <div className="form-group"><label>Icon</label><input type="file" accept="image/*" className="form-control-file" onChange={async (e) => e.target.files?.[0] && setIcon(await fileToDataUrl(e.target.files[0]))} /></div>
        <div className="form-group"><label>Image</label><input type="file" accept="image/*" className="form-control-file" onChange={async (e) => e.target.files?.[0] && setImage(await fileToDataUrl(e.target.files[0]))} /></div>
        <button className="btn btn-primary" disabled={busy}>Save</button>
      </form>
    </AdminModal>
  );
}
