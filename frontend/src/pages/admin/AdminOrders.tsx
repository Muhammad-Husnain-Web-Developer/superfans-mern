import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { assetImage } from '../../utils/format';
import { AdminShell, AdminModal } from './AdminShell';

interface Order {
  id: string; paymentStatus: number; createdAt: string;
  user: { usernameUrl: string; name: string; email: string } | null;
  buyerEmail: string;
  modal: { name: string; price: number; image: string | null } | null;
  productSlug: string;
  parts: Record<string, number | undefined>;
}

/** Admin Orders — port of admin/orders + view_order_details blades. */
export function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Order | null>(null);

  useEffect(() => { document.title = 'Admin | Orders'; void load(); }, []);
  async function load() {
    const { data } = await api.get<{ orders: Order[] }>('/admin/orders');
    setOrders(data.orders); setLoading(false);
  }

  return (
    <AdminShell title="Orders">
      {loading ? <p>Loading…</p> : orders.length === 0 ? (
        <p className="text-muted">No paid orders yet. (Merch orders appear here once checkout persists them.)</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="table table-bordered bg-white">
            <thead className="thead-dark"><tr><th>Customer</th><th>Product</th><th>Price</th><th>Date</th><th>Actions</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>{o.user ? `@${o.user.usernameUrl}` : o.buyerEmail || '— (guest)'}</td>
                  <td>{o.modal?.name ?? '—'}</td>
                  <td>€{o.modal?.price ?? 0}</td>
                  <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                  <td><button className="btn btn-sm btn-info" onClick={() => setDetail(o)}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <AdminModal title="Order Details" onClose={() => setDetail(null)}>
          <p><b>Customer:</b> {detail.user ? `${detail.user.name} (@${detail.user.usernameUrl}) — ${detail.user.email}` : detail.buyerEmail || '— (guest)'}</p>
          <p><b>Product:</b> {detail.modal?.name ?? '—'} — €{detail.modal?.price ?? 0}{detail.productSlug ? ` (${detail.productSlug})` : ''}</p>
          {detail.modal?.image && <img src={assetImage(detail.modal.image)} alt="" width={140} className="mb-2" />}
          {Object.values(detail.parts).some((v) => v != null) && (
            <>
              <p><b>Avatar parts:</b></p>
              <ul>{Object.entries(detail.parts).filter(([, v]) => v != null).map(([k, v]) => <li key={k}>{k}: {v}</li>)}</ul>
            </>
          )}
          <p><b>Date:</b> {new Date(detail.createdAt).toLocaleString()}</p>
        </AdminModal>
      )}
    </AdminShell>
  );
}
