import { useMemo, useState, type ReactNode } from 'react';

/**
 * Client-side DataTables chrome — the "Show [n] entries" + "Search:" header, a table body
 * (rendered per-page via the render-prop), and the "Showing X to Y of Z entries" +
 * Previous/Next footer. Mirrors the jQuery DataTables look used across the ads/admin blades.
 */
export function DataTableShell<T>({
  rows,
  searchText,
  children,
}: {
  rows: T[];
  searchText: (row: T) => string;
  children: (pageRows: T[]) => ReactNode;
}) {
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(
    () => rows.filter((r) => searchText(r).toLowerCase().includes(search.trim().toLowerCase())),
    [rows, search, searchText],
  );

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);

  return (
    <>
      <div className="d-flex justify-content-between align-items-center flex-wrap mb-2">
        <label className="mb-0">
          Show{' '}
          <select
            className="form-control form-control-sm d-inline-block"
            style={{ width: 70 }}
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>{' '}
          entries
        </label>
        <label className="mb-0">
          Search:{' '}
          <input
            type="search"
            className="form-control form-control-sm d-inline-block"
            style={{ width: 200 }}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </label>
      </div>

      <div style={{ overflowX: 'auto' }}>{children(pageRows)}</div>

      <div className="d-flex justify-content-between align-items-center flex-wrap mt-2">
        <div>
          Showing {total === 0 ? 0 : start + 1} to {Math.min(start + pageSize, total)} of {total} entries
        </div>
        <div className="btn-group">
          <button className="btn btn-sm btn-light border" disabled={current <= 1} onClick={() => setPage(current - 1)}>
            Previous
          </button>
          <button className="btn btn-sm btn-light border" disabled={current >= pageCount} onClick={() => setPage(current + 1)}>
            Next
          </button>
        </div>
      </div>
    </>
  );
}
