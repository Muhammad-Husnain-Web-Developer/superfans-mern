import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { api } from '../../api/client';
import { assetImage, isVideoFile, videoMime } from '../../utils/format';
import { useStandalonePageStyles, BOOTSTRAP4_CDN } from '../../components/StandalonePage';
import { AdsSidebar } from './AdsSidebar';
import { DataTableShell } from './DataTableShell';

interface AdminAd {
  id: string;
  adType: string;
  media: string | null;
  status: boolean;
  approved: boolean;
  amount: number;
  createdAt: string;
  user: { usernameUrl: string; name: string; email: string } | null;
}

/** Admin: Manage All Ads — port of ads/all-ads.blade.php with approve/reject + stop/play. */
export function AllAds() {
  useStandalonePageStyles([BOOTSTRAP4_CDN, '/page-css/ads-center.css']);
  const [ads, setAds] = useState<AdminAd[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Superfans | All Ads (Admin)';
    void load();
  }, []);

  async function load() {
    try {
      const { data } = await api.get<{ ads: AdminAd[] }>('/ads/all');
      setAds(data.ads);
    } catch (e) {
      setError(isAxiosError(e) && e.response?.status === 403 ? 'Admin access only.' : 'Could not load ads.');
    } finally {
      setLoading(false);
    }
  }

  async function decide(ad: AdminAd, action: 'approve' | 'reject') {
    await api.put(`/ads/${ad.id}/${action}`);
    await load();
  }

  async function toggleStatus(ad: AdminAd) {
    try {
      await api.put(`/ads/${ad.id}/toggle-status`);
      await load();
    } catch (e) {
      if (isAxiosError(e)) window.alert(e.response?.data?.message ?? 'Could not update status.');
    }
  }

  return (
    <>
      <AdsSidebar />
      <div className="main">
        <h2 className="mb-4">Manage All Ads</h2>
        {loading ? (
          <p>Loading…</p>
        ) : error ? (
          <div className="alert alert-warning">{error}</div>
        ) : (
          <DataTableShell rows={ads} searchText={(a) => `${a.id} ${a.adType} ${a.user?.usernameUrl ?? ''} ${a.status ? 'running' : 'stopped'} ${a.approved ? 'approved' : 'pending'}`}>
            {(pageRows) => (
              <table className="table table-bordered table-striped">
                <thead className="thead-dark">
                  <tr><th>ID</th><th>Preview</th><th>Type</th><th>Status</th><th>Created</th><th>Approval</th><th>Budget</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 && (
                    <tr><td colSpan={8} className="text-center">No ads found.</td></tr>
                  )}
                  {pageRows.map((ad) => (
                    <tr key={ad.id}>
                      <td>{ad.id.slice(-6)}</td>
                      <td>
                        {ad.media ? (
                          isVideoFile(ad.media) ? (
                            <video width={110} muted><source src={assetImage(ad.media)} type={videoMime(ad.media)} /></video>
                          ) : (
                            <img src={assetImage(ad.media)} alt="" width={110} />
                          )
                        ) : '—'}
                      </td>
                      <td>{ad.adType || 'N/A'}</td>
                      <td><span className={`badge badge-${ad.status ? 'success' : 'secondary'}`}>{ad.status ? 'Running' : 'Stopped'}</span></td>
                      <td>{new Date(ad.createdAt).toLocaleDateString()}</td>
                      <td><span className={`badge badge-${ad.approved ? 'success' : 'warning'}`}>{ad.approved ? 'Approved' : 'Pending'}</span></td>
                      <td>€{ad.amount}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {ad.approved ? (
                          <button className="btn btn-sm btn-secondary mr-1" onClick={() => decide(ad, 'reject')}>Reject</button>
                        ) : (
                          <button className="btn btn-sm btn-success mr-1" onClick={() => decide(ad, 'approve')}>Approve</button>
                        )}
                        <button className={`btn btn-sm btn-${ad.status ? 'warning' : 'primary'}`} onClick={() => toggleStatus(ad)}>
                          {ad.status ? 'Stop' : 'Play'}
                        </button>
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
