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
  numbered = false,
}: {
  rows: T[];
  searchText: (row: T) => string;
  children: (pageRows: T[]) => ReactNode;
  /** Draw DataTables' numbered pager (Previous 1 2 3 … Next) instead of the
      plain Previous/Next pair. The admin panel blades show the numbers. */
  numbered?: boolean;
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
          {/* the classes DataTables' Bootstrap 4 skin puts on this control, which
              is where its chevron comes from — a native arrow otherwise */}
          <select
            className="custom-select custom-select-sm form-control form-control-sm d-inline-block"
            style={{ width: 'auto' }}
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
            style={{ width: 177 }}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </label>
      </div>

      <div style={{ overflowX: 'auto' }}>{children(pageRows)}</div>

      <div className="d-flex justify-content-between align-items-center flex-wrap mt-2">
        <div className="dataTables_info">
          Showing {total === 0 ? 0 : start + 1} to {Math.min(start + pageSize, total)} of {total} entries
        </div>
        {numbered ? (
          <div className="dataTables_paginate paging_simple_numbers">
            <ul className="pagination">
              <li className={`paginate_button page-item previous${current <= 1 ? ' disabled' : ''}`}>
                <button type="button" className="page-link" onClick={() => setPage(current - 1)}>
                  Previous
                </button>
              </li>
              {pageWindow(current, pageCount).map((n, i) =>
                n === null ? (
                  <li key={`gap${i}`} className="paginate_button page-item disabled">
                    <span className="page-link">&hellip;</span>
                  </li>
                ) : (
                  <li key={n} className={`paginate_button page-item${n === current ? ' active' : ''}`}>
                    <button type="button" className="page-link" onClick={() => setPage(n)}>
                      {n}
                    </button>
                  </li>
                ),
              )}
              <li className={`paginate_button page-item next${current >= pageCount ? ' disabled' : ''}`}>
                <button type="button" className="page-link" onClick={() => setPage(current + 1)}>
                  Next
                </button>
              </li>
            </ul>
          </div>
        ) : (
          <div className="btn-group">
            <button className="btn btn-sm btn-light border" disabled={current <= 1} onClick={() => setPage(current - 1)}>
              Previous
            </button>
            <button className="btn btn-sm btn-light border" disabled={current >= pageCount} onClick={() => setPage(current + 1)}>
              Next
            </button>
          </div>
        )}
      </div>
    </>
  );
}

/**
 * The run of page buttons DataTables draws: up to seven, with the current page
 * kept in the middle and an ellipsis standing in for whatever it skipped.
 * `null` marks a gap.
 */
function pageWindow(current: number, pageCount: number): (number | null)[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, null, pageCount];
  if (current >= pageCount - 3) {
    return [1, null, pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1, pageCount];
  }
  return [1, null, current - 1, current, current + 1, null, pageCount];
}
