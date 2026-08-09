import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { assetImage } from '../../utils/format';
import { AdminShell, AdminModal } from './AdminShell';

interface Asset { id: string; name: string; parent: number | null; icon: string | null; iconOff: string | null; image: string | null; zIndex: number; }
interface WMark { id: string; image: string | null; }

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(file); });
}

/** Admin Assets — port of admin/assets + add_asset + edit_asset + watermark blades. */
export function AdminAssets() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [watermarks, setWatermarks] = useState<WMark[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Asset | 'new' | null>(null);
  const [wmOpen, setWmOpen] = useState(false);

  useEffect(() => { document.title = 'Admin | Assets'; void load(); }, []);
  async function load() {
    const { data } = await api.get<{ assets: Asset[]; watermarks: WMark[] }>('/admin/assets');
    setAssets(data.assets); setWatermarks(data.watermarks); setLoading(false);
  }
  async function delAsset(a: Asset) { if (!window.confirm(`Delete ${a.name}?`)) return; await api.delete(`/admin/assets/${a.id}`); await load(); }
  async function delWm(w: WMark) { if (!window.confirm('Delete watermark?')) return; await api.delete(`/admin/watermarks/${w.id}`); await load(); }

  return (
    <AdminShell title="Assets">
      <button className="btn btn-primary mb-3 mr-2" onClick={() => setEditing('new')}>+ Add Asset</button>
      <button className="btn btn-outline-primary mb-3" onClick={() => setWmOpen(true)}>+ Add Watermark</button>

      {loading ? <p>Loading…</p> : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table className="table table-bordered bg-white">
              <thead className="thead-dark"><tr><th>Icon</th><th>Name</th><th>Parent</th><th>z-index</th><th>Actions</th></tr></thead>
              <tbody>
                {assets.length === 0 ? <tr><td colSpan={5} className="text-muted">No assets yet.</td></tr> : assets.map((a) => (
                  <tr key={a.id}>
                    <td>{a.icon ? <img src={assetImage(a.icon)} alt="" width={44} /> : '—'}</td>
                    <td>{a.name}</td><td>{a.parent ?? '—'}</td><td>{a.zIndex}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn btn-sm btn-success mr-1" onClick={() => setEditing(a)}>Edit</button>
                      <button className="btn btn-sm btn-danger" onClick={() => delAsset(a)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h4 className="mt-4">Watermarks</h4>
          <div className="d-flex flex-wrap" style={{ gap: 12 }}>
            {watermarks.length === 0 ? <p className="text-muted">No watermarks.</p> : watermarks.map((w) => (
              <div key={w.id} className="border bg-white p-2 text-center">
                {w.image ? <img src={assetImage(w.image)} alt="" width={90} /> : '—'}
                <div><button className="btn btn-sm btn-danger mt-1" onClick={() => delWm(w)}>Delete</button></div>
              </div>
            ))}
          </div>
        </>
      )}

      {editing && <AssetForm asset={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} />}
      {wmOpen && <WatermarkForm onClose={() => setWmOpen(false)} onSaved={async () => { setWmOpen(false); await load(); }} />}
    </AdminShell>
  );
}

function AssetForm({ asset, onClose, onSaved }: { asset: Asset | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(asset?.name ?? '');
  const [parent, setParent] = useState(String(asset?.parent ?? ''));
  const [zIndex, setZIndex] = useState(String(asset?.zIndex ?? 0));
  const [icon, setIcon] = useState(''); const [iconOff, setIconOff] = useState(''); const [image, setImage] = useState('');
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const body: Record<string, unknown> = { name, parent, z_index: zIndex };
    if (icon) body.icon = icon; if (iconOff) body.icon_off = iconOff; if (image) body.image = image;
    try {
      if (asset) await api.put(`/admin/assets/${asset.id}`, body);
      else await api.post('/admin/assets', body);
      onSaved();
    } finally { setBusy(false); }
  }
  return (
    <AdminModal title={asset ? 'Edit Asset' : 'Add Asset'} onClose={onClose}>
      <form onSubmit={save}>
        <div className="form-group"><label>Name</label><input className="form-control" value={name} onChange={(e) => setName(e.target.value)} required /></div>
        <div className="form-row">
          <div className="form-group col"><label>Parent (id)</label><input type="number" className="form-control" value={parent} onChange={(e) => setParent(e.target.value)} /></div>
          <div className="form-group col"><label>z-index</label><input type="number" className="form-control" value={zIndex} onChange={(e) => setZIndex(e.target.value)} /></div>
        </div>
        <div className="form-group"><label>Icon (on)</label><input type="file" accept="image/*" className="form-control-file" onChange={async (e) => e.target.files?.[0] && setIcon(await fileToDataUrl(e.target.files[0]))} /></div>
        <div className="form-group"><label>Icon (off)</label><input type="file" accept="image/*" className="form-control-file" onChange={async (e) => e.target.files?.[0] && setIconOff(await fileToDataUrl(e.target.files[0]))} /></div>
        <div className="form-group"><label>Image</label><input type="file" accept="image/*" className="form-control-file" onChange={async (e) => e.target.files?.[0] && setImage(await fileToDataUrl(e.target.files[0]))} /></div>
        <button className="btn btn-primary" disabled={busy}>Save</button>
      </form>
    </AdminModal>
  );
}

function WatermarkForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [image, setImage] = useState(''); const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!image) return; setBusy(true);
    try { await api.post('/admin/watermarks', { image }); onSaved(); } finally { setBusy(false); }
  }
  return (
    <AdminModal title="Add Watermark" onClose={onClose}>
      <form onSubmit={save}>
        <div className="form-group"><label>Watermark image</label><input type="file" accept="image/*" className="form-control-file" onChange={async (e) => e.target.files?.[0] && setImage(await fileToDataUrl(e.target.files[0]))} required /></div>
        <button className="btn btn-primary" disabled={busy || !image}>Save</button>
      </form>
    </AdminModal>
  );
}
