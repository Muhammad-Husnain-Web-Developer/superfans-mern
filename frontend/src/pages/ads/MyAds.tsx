import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { assetImage, formatPrice, isVideoFile, videoMime } from '../../utils/format';
import { useStandalonePageStyles, BOOTSTRAP4_CDN } from '../../components/StandalonePage';
import { usePaymentReturn } from '../../utils/usePaymentReturn';
import { AdsSidebar } from './AdsSidebar';
import { DataTableShell } from './DataTableShell';

interface MyAd {
  id: string;
  adType: string;
  media: string | null;
  status: boolean;
  approved: boolean;
  amount: number;
  paid: boolean;
  createdAt: string;
}

/** My Ads — port of ads/my-ads.blade.php: a table of the advertiser's ads with pay/delete. */
export function MyAds() {
  useStandalonePageStyles([BOOTSTRAP4_CDN, '/page-css/ads-center.css']);
  const [ads, setAds] = useState<MyAd[]>([]);
  const [loading, setLoading] = useState(true);
  const paymentStatus = usePaymentReturn(() => void load());
  /* the same `?as=` the centre carries: a business looking at a linked account's ads */
  const [params] = useSearchParams();
  const as = params.get('as');

  useEffect(() => {
    document.title = 'Superfans | My Ads';
    void load();
  }, [as]);

  async function load() {
    const { data } = await api.get<{ ads: MyAd[] }>(
      `/ads/my-ads${as ? `?as=${encodeURIComponent(as)}` : ''}`,
    );
    setAds(data.ads);
    setLoading(false);
  }

  async function pay(ad: MyAd) {
    const { data } = await api.post<{ url?: string }>('/ads/pay-existing', {
      ad_id: ad.id,
      amount: ad.amount,
      ...(as ? { onBehalfOf: as } : {}),
    });
    if (data.url) window.location.href = data.url;
  }

  /* the blade's Play/Stop, which only the ad's owner may press and only once approved */
  async function toggleStatus(ad: MyAd) {
    try {
      await api.put(`/ads/${ad.id}/toggle-status`);
      await load();
    } catch (e) {
      window.alert(
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
          'Could not update status.',
      );
    }
  }

  async function remove(ad: MyAd) {
    if (!window.confirm('Delete this ad?')) return;
    const { data } = await api.delete<{ message: string }>(`/ads/${ad.id}`);
    window.alert(data.message);
    await load();
  }

  return (
    <>
      <AdsSidebar active="my-ads" />
      <div className="main">
        <h2 className="mb-4">Manage My Ads</h2>
        {paymentStatus && (
          <div className="alert alert-info">{paymentStatus.message}</div>
        )}

        {loading ? (
          <p>Loading…</p>
        ) : (
          <DataTableShell
            rows={ads}
            searchText={(ad) => `${ad.id} ${ad.adType} ${ad.status ? 'running' : 'stopped'} ${ad.approved ? 'approved' : 'pending'}`}
          >
            {(pageRows) => (
            <table className="table table-bordered">
              <thead className="thead-dark">
                <tr>
                  <th>ID</th><th>Preview</th><th>Type</th><th>Status</th><th>Payment</th>
                  <th>Approval Status</th><th>Budget</th><th>Created</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 && (
                  <tr><td colSpan={9} className="text-center">No ads found.</td></tr>
                )}
                {pageRows.map((ad) => (
                  <tr key={ad.id}>
                    <td>{ad.id.slice(-6)}</td>
                    <td className="media-td">
                      {ad.media ? (
                        isVideoFile(ad.media) ? (
                          <video width={120} muted><source src={assetImage(ad.media)} type={videoMime(ad.media)} /></video>
                        ) : (
                          <img src={assetImage(ad.media)} alt="" width={120} />
                        )
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>{ad.adType || 'N/A'}</td>
                    <td><span className={`badge badge-${ad.status ? 'success' : 'secondary'}`}>{ad.status ? 'Running' : 'Stopped'}</span></td>
                    <td>
                      {ad.paid ? (
                        <span className="badge badge-success">Paid</span>
                      ) : (
                        <button className="btn btn-sm btn-success" onClick={() => pay(ad)}>Pay {formatPrice(ad.amount)}</button>
                      )}
                    </td>
                    <td><span className={`badge badge-${ad.approved ? 'success' : 'secondary'}`}>{ad.approved ? 'Approved' : 'Pending Review'}</span></td>
                    <td>{formatPrice(ad.amount)}</td>
                    <td>{new Date(ad.createdAt).toLocaleDateString()}</td>
                    <td>
                      <button
                        className={`btn btn-sm btn-${ad.status ? 'warning' : 'primary'} mr-1`}
                        onClick={() => void toggleStatus(ad)}
                      >
                        {ad.status ? 'Stop' : 'Play'}
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => void remove(ad)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </DataTableShell>
        )}
      </div>
    </>
  );
}
