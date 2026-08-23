import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { isAxiosError } from 'axios';
import { assetImage } from '../../utils/format';
import { useStandalonePageStyles, BOOTSTRAP4_CDN } from '../../components/StandalonePage';
import { AdsSidebar } from './AdsSidebar';
import { DataTableShell } from './DataTableShell';

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  answers: string[];
  createdAt: string;
  media: string | null;
  adType: string;
  amount: number;
}

/** Potential Clients — port of ads/potential_clients.blade.php (business-only lead list). */
export function PotentialClients() {
  useStandalonePageStyles([BOOTSTRAP4_CDN, '/page-css/ads-center.css']);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Superfans | Potential Clients';
    api
      .get<{ leads: Lead[] }>('/ads/potential-clients')
      .then(({ data }) => setLeads(data.leads))
      .catch((e) => {
        if (isAxiosError(e) && e.response?.status === 403) setError('Only business accounts can access this page.');
        else setError('Could not load leads.');
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <AdsSidebar active="clients" />
      <div className="main">
        <h2 className="mb-4">Potential Clients</h2>
        {loading ? (
          <p>Loading…</p>
        ) : error ? (
          <div className="alert alert-warning">{error}</div>
        ) : (
          <DataTableShell rows={leads} searchText={(l) => `${l.id} ${l.name} ${l.email} ${l.phone} ${l.company}`}>
            {(pageRows) => (
              <table className="table table-bordered table-striped">
                <thead className="thead-dark">
                  <tr>
                    <th>ID</th><th>Preview</th><th>Name</th><th>Email</th><th>Phone</th>
                    <th>Company</th><th>Answers</th><th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 && (
                    <tr><td colSpan={8} className="text-center">No clients yet.</td></tr>
                  )}
                  {pageRows.map((l) => (
                    <tr key={l.id}>
                      <td>{l.id.slice(-6)}</td>
                      <td>{l.media ? <img src={assetImage(l.media)} alt="" width={60} /> : '—'}</td>
                      <td>{l.name || '—'}</td>
                      <td>{l.email || '—'}</td>
                      <td>{l.phone || '—'}</td>
                      <td>{l.company || '—'}</td>
                      {/* the blade prints each answer on its own line behind a bold Q1..Q4 */}
                      <td style={{ textAlign: 'left' }}>
                        {l.answers.length
                          ? l.answers.map((a, i) => (
                              <span key={i}>
                                <b>Q{i + 1}:</b> {a}
                                <br />
                              </span>
                            ))
                          : '—'}
                      </td>
                      <td>{new Date(l.createdAt).toLocaleDateString()}</td>
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
