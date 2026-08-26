import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { api } from '../../api/client';
import {
  BOOTSTRAP4_CDN,
  DATATABLES_BOOTSTRAP4_CSS,
  useStandalonePageStyles,
} from '../../components/StandalonePage';
import { DataTableShell } from '../ads/DataTableShell';

interface PanelUser {
  id: string;
  usernameUrl: string;
  email: string;
  role: string;
  status: string;
  verified: boolean;
  vip: boolean;
  noOfFollowers: number;
  growthStatus: string;
  growthGearLevel: number;
}

type Flash = { kind: 'success' | 'danger'; text: string } | null;

/** The blade's dismissible alert strip (all_users.blade.php:33). */
function Alert({ flash, onClose }: { flash: Flash; onClose: () => void }) {
  if (!flash) return null;
  return (
    <div className={`alert alert-${flash.kind} alert-dismissible fade show`} role="alert">
      <h5>
        <b>{flash.text}</b>
      </h5>
      <button type="button" className="close" aria-label="Close" onClick={onClose}>
        <span aria-hidden="true">&times;</span>
      </button>
    </div>
  );
}

/** One row of the table — its own state so a busy control never freezes the page. */
function UserRow({
  user,
  onFlash,
  onChanged,
}: {
  user: PanelUser;
  onFlash: (f: Flash) => void;
  onChanged: (u: Partial<PanelUser> & { id: string }) => void;
}) {
  const navigate = useNavigate();
  const [amount, setAmount] = useState('');
  const [gear, setGear] = useState(user.growthGearLevel || 1);
  const [busy, setBusy] = useState(false);

  /** Every control reports the way the blade does: a flash at the top of the page. */
  const call = useCallback(
    async (run: () => Promise<{ message?: string } & Record<string, unknown>>, patch?: (d: never) => void) => {
      setBusy(true);
      try {
        const data = await run();
        onFlash({ kind: 'success', text: String(data.message ?? '') });
        patch?.(data as never);
      } catch (err) {
        const text = isAxiosError(err)
          ? ((err.response?.data as { message?: string } | undefined)?.message ?? 'Something went wrong')
          : 'Something went wrong';
        onFlash({ kind: 'danger', text });
      } finally {
        setBusy(false);
      }
    },
    [onFlash],
  );

  const suspended = user.status === 'suspended';
  const deleted = user.status === 'deleted';
  const growing = user.growthStatus === 'active';

  return (
    <tr>
      <td>{user.usernameUrl}</td>

      <td>
        {user.email}
        <br />
        <br />

        {/* Suspend / Unsuspend toggle */}
        <button
          type="button"
          className={`btn btn-sm ${suspended ? 'btn-success' : 'btn-warning'}`}
          disabled={busy}
          onClick={() => {
            if (!window.confirm(`${suspended ? 'Un-suspend' : 'Suspend'} this user?`)) return;
            void call(
              async () => (await api.post(`/admin/users/${user.id}/suspend`)).data,
              (d: { status: string }) => onChanged({ id: user.id, status: d.status }),
            );
          }}
        >
          {suspended ? 'Unsuspend' : 'Suspend'}
        </button>{' '}
        {/* Delete / Restore toggle — the row is never removed, only marked */}
        <button
          type="button"
          className={`btn btn-sm ${deleted ? 'btn-success' : 'btn-danger'}`}
          disabled={busy}
          onClick={() => {
            if (!window.confirm(`${deleted ? 'Restore' : 'Delete'} this user?`)) return;
            void call(
              async () => (await api.post(`/admin/users/${user.id}/delete-toggle`)).data,
              (d: { status: string }) => onChanged({ id: user.id, status: d.status }),
            );
          }}
        >
          {deleted ? 'Restore' : 'Delete'}
        </button>
      </td>

      <td>
        <b>{user.noOfFollowers ? user.noOfFollowers : 'No Followers'}</b>
      </td>

      <td>
        <b>{user.role}</b>
      </td>

      <td>
        <input
          type="number"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </td>

      <td>
        <input
          type="submit"
          className="btn btn-success my-1"
          value="Add"
          disabled={busy}
          onClick={() => {
            if (!amount) return;
            void call(
              async () => (await api.post(`/admin/users/${user.id}/followers`, { action: 'add', amount })).data,
              (d: { noOfFollowers: number }) => onChanged({ id: user.id, noOfFollowers: d.noOfFollowers }),
            );
          }}
        />{' '}
        <input
          type="submit"
          className="btn btn-danger my-1"
          value="Remove"
          disabled={busy}
          onClick={() => {
            if (!amount) return;
            void call(
              async () => (await api.post(`/admin/users/${user.id}/followers`, { action: 'remove', amount })).data,
              (d: { noOfFollowers: number }) => onChanged({ id: user.id, noOfFollowers: d.noOfFollowers }),
            );
          }}
        />
      </td>

      <td>
        {/* the blade wraps each control group in its own <form>; those blocks are
            what keep these columns from claiming a whole line of width */}
        <form onSubmit={(e) => e.preventDefault()}>
          <input
            type="submit"
            value="Posts"
            className="btn btn-warning"
            onClick={() => navigate(`/influencer/all_user_posts/${user.id}`)}
          />
        </form>
      </td>

      <td>
        <form onSubmit={(e) => e.preventDefault()}>
        {/* Growth gear — the slider only shows while growth is off, as in the blade */}
        {growing ? (
          <small style={{ color: 'black' }}>Growth is active at Gear {user.growthGearLevel}</small>
        ) : (
          <>
            <input
              type="range"
              min={1}
              max={5}
              value={gear}
              className="form-range"
              style={{ width: '100%' }}
              onChange={(e) => setGear(Number(e.target.value))}
            />
            <small style={{ color: 'black' }}>
              Gear: <span>{gear}</span>
            </small>
          </>
        )}

        <button
          type="button"
          className={`btn btn-sm ${growing ? 'btn-danger' : 'btn-primary'} mt-1`}
          disabled={busy}
          onClick={() =>
            void call(
              async () => (await api.post(`/admin/growth/${user.id}`, { gear })).data,
              (d: { growthStatus?: string; growthGearLevel?: number }) =>
                onChanged({
                  id: user.id,
                  growthStatus: d.growthStatus ?? (growing ? 'inactive' : 'active'),
                  growthGearLevel: d.growthGearLevel ?? gear,
                }),
            )
          }
        >
          {growing ? 'Stop' : 'Start'}
        </button>
        </form>

        <form onSubmit={(e) => e.preventDefault()}>
        <div className="custom-control custom-switch">
          <input
            type="checkbox"
            className="custom-control-input"
            id={`vipSwitch${user.id}`}
            checked={user.vip}
            disabled={busy}
            onChange={(e) => {
              const vip = e.target.checked;
              void call(async () => {
                await api.put(`/admin/users/${user.id}`, { vip });
                onChanged({ id: user.id, vip });
                return { message: 'VIP status updated.' };
              });
            }}
          />
          <label className="custom-control-label" htmlFor={`vipSwitch${user.id}`}>
            VIP
          </label>
        </div>
        </form>
      </td>

      <td>
        <form onSubmit={(e) => e.preventDefault()}>
        <div className="custom-control custom-switch">
          <input
            type="checkbox"
            className="custom-control-input"
            id={`verifiedSwitch${user.id}`}
            checked={user.verified}
            disabled={busy}
            onChange={(e) => {
              const verified = e.target.checked;
              void call(async () => {
                await api.put(`/admin/users/${user.id}`, { verified });
                onChanged({ id: user.id, verified });
                return { message: 'Verified status updated.' };
              });
            }}
          />
          <label className="custom-control-label" htmlFor={`verifiedSwitch${user.id}`}>
            {user.verified ? 'Verified' : 'Not Verified'}
          </label>
        </div>
        </form>
      </td>
    </tr>
  );
}

const COLUMNS = [
  'Username',
  'Email',
  'Followers',
  'Role',
  'No.of Followers',
  'Followers Action',
  'Posts',
  'Growth Gear',
  'Verified',
];

/**
 * DataTables sizes the columns itself and writes the result onto each header as
 * an inline width, so the table does not lay out the way the browser alone
 * would. Read off the running blade at 1400px -- 196.4 / 290.8 / 71.8 / 61.7 /
 * 175 / 71.8 / 48.8 / 56.1 / 63.4 px -- and carried here as the shares of the
 * table they represent, which hold at any width since the table is full-bleed.
 *
 * It is what puts Start on its own line under "Gear: 5": the column is too
 * narrow to seat both, and left to itself the browser hands it enough room to
 * sit them side by side.
 */
const COLUMN_WIDTHS = ['18.962%', '28.078%', '6.933%', '5.957%', '16.895%', '6.933%', '4.707%', '5.414%', '6.121%'];

/**
 * DataTables makes every column sortable and orders by what the cell reads, so
 * each one here returns the text its cell shows -- including the columns that
 * hold controls, whose captions are all it has to go on.
 */
const SORT_KEYS: ((u: PanelUser) => string)[] = [
  (u) => u.usernameUrl,
  (u) => `${u.email} ${u.status === 'suspended' ? 'Unsuspend' : 'Suspend'} ${u.status === 'deleted' ? 'Restore' : 'Delete'}`,
  (u) => String(u.noOfFollowers ? u.noOfFollowers : 'No Followers'),
  (u) => u.role,
  () => '',
  () => 'Add Remove',
  () => 'Posts',
  (u) =>
    u.growthStatus === 'active'
      ? `Growth is active at Gear ${u.growthGearLevel} Stop VIP`
      : `Gear: ${u.growthGearLevel} Start VIP`,
  (u) => (u.verified ? 'Verified' : 'Not Verified'),
];

/** DataTables' own string ordering: lowercase, then a plain comparison. That is
    what puts digits and @ ahead of letters, unlike a locale-aware compare. */
function dataTablesCompare(a: string, b: string): number {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x < y ? -1 : x > y ? 1 : 0;
}

/**
 * influencer/all_users.blade.php — the owner's user panel.
 *
 * A standalone Bootstrap 4 page, as the blade is: no site chrome, a dark-headed
 * striped table and the DataTables "Show / Search / pagination" frame around it.
 * Every column, control and message is the blade's.
 */
export function AllUsers() {
  /* the blade links both (all_users.blade.php:10, :11); the DataTables sheet is
     what draws the sort arrows on the headers */
  useStandalonePageStyles([BOOTSTRAP4_CDN, DATATABLES_BOOTSTRAP4_CSS]);
  const [users, setUsers] = useState<PanelUser[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [perPage, setPerPage] = useState(700);
  /* DataTables opens on the first column ascending, which is what the blade shows */
  const [sort, setSort] = useState<{ col: number; dir: 'asc' | 'desc' }>({ col: 0, dir: 'asc' });
  const [flash, setFlash] = useState<Flash>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'denied'>('loading');
  /* What was typed, and what has actually been sent. The table only ever held 700 of the
     users, so its own Search box could not find anybody outside that slice; the term now
     goes to the server and the whole table is searched. */
  const [term, setTerm] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    document.title = 'Superfans | All Users';
  }, []);

  /* a beat after the typing stops, so a search is one request rather than one per letter */
  useEffect(() => {
    const id = window.setTimeout(() => {
      setQuery(term.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(id);
  }, [term]);

  useEffect(() => {
    api
      .get<{ users: PanelUser[]; lastPage: number; total: number; perPage: number }>(
        `/admin/all-users?page=${page}&search=${encodeURIComponent(query)}`,
      )
      .then((r) => {
        setUsers(r.data.users);
        setLastPage(r.data.lastPage);
        setTotal(r.data.total);
        setPerPage(r.data.perPage);
        setState('ok');
      })
      .catch(() => setState('denied'));
  }, [page, query]);

  const patch = useCallback((u: Partial<PanelUser> & { id: string }) => {
    setUsers((prev) => prev.map((p) => (p.id === u.id ? { ...p, ...u } : p)));
  }, []);

  const sorted = useMemo(() => {
    const read = SORT_KEYS[sort.col];
    if (!read) return users;
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...users].sort((a, b) => dataTablesCompare(read(a), read(b)) * factor);
  }, [users, sort]);

  if (state === 'loading') return null;
  if (state === 'denied') {
    return (
      <div className="container-fluid my-4 w-100">
        <div className="alert alert-danger">
          <h5>
            <b>Admin access only.</b>
          </h5>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid my-4 w-100">
      {/* The blade's stylesheet says 90%, but DataTables lays the table out
          itself and the running page measures 100%. Matching what is on
          screen, not what the sheet asks for. */}
      <style>{`#allUsersTable { width: 100%; }`}</style>

      <Alert flash={flash} onClose={() => setFlash(null)} />

      <DataTableShell
        rows={sorted}
        searchText={(u) => `${u.usernameUrl} ${u.email} ${u.role}`}
        numbered
        onSearch={setTerm}
      >
        {(pageRows) => (
          <table id="allUsersTable" className="table table-striped table-bordered dataTable no-footer">
            <thead>
              <tr className="bg-dark text-white">
                {COLUMNS.map((label, i) => (
                  /* DataTables' own classes: the stylesheet linked above turns
                     them into the arrows beside each heading, and the sorted
                     column carries both `sorting` and its direction */
                  <th
                    key={label}
                    className={`sorting${sort.col === i ? ` sorting_${sort.dir}` : ''}`}
                    style={{ cursor: 'pointer', width: COLUMN_WIDTHS[i] }}
                    onClick={() =>
                      setSort((s) => ({ col: i, dir: s.col === i && s.dir === 'asc' ? 'desc' : 'asc' }))
                    }
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((u) => (
                <UserRow key={u.id} user={u} onFlash={setFlash} onChanged={patch} />
              ))}
            </tbody>
          </table>
        )}
      </DataTableShell>

      {/* The blade's own paginator under the table ({{ $users->links() }}). The
          DataTable above pages within the 700 users on screen; this one fetches
          the next 700, and prints the same "Showing … results" line Laravel
          does. */}
      {lastPage > 1 && (
        <div className="d-flex justify-content-center">
          <nav>
            <div className="d-flex align-items-center flex-wrap" style={{ gap: 12 }}>
              <button
                type="button"
                className="btn btn-link p-0"
                disabled={page === 1}
                onClick={() => setPage((n) => Math.max(1, n - 1))}
              >
                &laquo; Previous
              </button>
              <button
                type="button"
                className="btn btn-link p-0"
                disabled={page === lastPage}
                onClick={() => setPage((n) => Math.min(lastPage, n + 1))}
              >
                Next &raquo;
              </button>
              <span>
                Showing {(page - 1) * perPage + 1} to {Math.min(page * perPage, total)} of {total} results
              </span>
              {Array.from({ length: lastPage }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`btn btn-link p-0${n === page ? ' font-weight-bold' : ''}`}
                  onClick={() => setPage(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
