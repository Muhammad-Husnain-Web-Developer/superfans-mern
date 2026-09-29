import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { assetImage, isVideoFile, videoMime } from '../../utils/format';
import { useStandalonePageStyles, BOOTSTRAP4_CDN } from '../../components/StandalonePage';
import { AdsSidebar } from './AdsSidebar';
import { DataTableShell } from './DataTableShell';

interface InfoAd {
  id: string;
  adType: string;
  media: string | null;
  amount: number;
  impressions: number;
  clicks: number;
  spent: number;
  remaining: number;
}

/** $X,XXX.XX — the number_format($n, 2) with a $ prefix used across information.blade. */
const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Inform Ads — port of ads/information.blade.php: per-ad budget/impressions/clicks/spent/remaining. */
export function AdsInformation() {
  /* a business working inside a linked account passes its id along (Vinculacion Partner) */
  const [params] = useSearchParams();
  const as = params.get('as');
  useStandalonePageStyles([BOOTSTRAP4_CDN, '/page-css/ads-center.css']);
  const [ads, setAds] = useState<InfoAd[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Superfans | Inform Ads';
    api
      .get<{ ads: InfoAd[] }>(`/ads/information${as ? `?as=${encodeURIComponent(as)}` : ''}`)
      .then(({ data }) => setAds(data.ads))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <AdsSidebar active="info" />
      <div className="main">
        <h2 className="mb-4">Inform Ads</h2>
        {loading ? (
          <p>Loading…</p>
        ) : (
          <DataTableShell rows={ads} searchText={(a) => `${a.id} ${a.adType}`}>
            {(pageRows) => (
              <table className="table table-bordered table-striped">
                <thead className="thead-dark">
                  <tr>
                    <th>ID</th><th>Preview</th><th>Type</th><th>Budget</th>
                    <th>Impressions</th><th>Clicks</th><th>Spent</th><th>Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 && (
                    <tr><td colSpan={8} className="text-center">No data available in table</td></tr>
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
                      <td>{ad.adType}</td>
                      <td>{usd(ad.amount)}</td>
                      <td>{ad.impressions.toLocaleString('en-US')}</td>
                      <td>{ad.clicks.toLocaleString('en-US')}</td>
                      <td>{usd(ad.spent)}</td>
                      <td>{usd(ad.remaining)}</td>
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
