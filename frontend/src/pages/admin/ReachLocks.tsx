import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { isAxiosError } from 'axios';
import { api } from '../../api/client';
import { BOOTSTRAP4_CDN, useStandalonePageStyles } from '../../components/StandalonePage';

/**
 * The two lockers the client asked for beside his user panel — no Laravel original.
 *
 * "Country Zone Post Locker": posts made in one place, shown in another, at a figure he sets.
 * "User Individual Locker Country": one account's posts, shown in a place, at a figure he sets.
 * Either may name a region (Catalunya) instead of a whole country; cities he withdrew.
 *
 * Same standalone Bootstrap 4 shell as all_users, and the same gate: the API answers only the
 * owner, and anybody else sees the "Admin access only" strip that panel shows. The account is
 * picked from a suggestion list rather than typed, the way the site's own influencer search
 * works, so a rule can only ever name somebody who exists.
 */

interface Place {
  country: string;
  region: string | null;
}

interface Lock {
  id: string;
  kind: 'zone' | 'user';
  user: { id: string; usernameUrl: string; email: string } | null;
  from: Place | null;
  to: Place;
  percent: number;
}

interface Named {
  name: string;
  iso2: string;
}

interface PickedUser {
  id: string;
  usernameUrl: string;
  email: string;
  role: string;
}

type Flash = { kind: 'success' | 'danger'; text: string } | null;

const EMPTY_PLACE: Place = { country: '', region: null };

function errorText(err: unknown): string {
  if (!isAxiosError(err)) return 'Something went wrong';
  const body = err.response?.data as { message?: string; details?: { message: string }[] } | undefined;
  return body?.details?.[0]?.message ?? body?.message ?? 'Something went wrong';
}

/* ---------- reference data, fetched once a tab ---------- */

let countriesPromise: Promise<Named[]> | null = null;
const regionsCache = new Map<string, Promise<Named[]>>();

function fetchCountries(): Promise<Named[]> {
  if (!countriesPromise) {
    countriesPromise = api
      .get<{ data: Named[] }>('/geo/countries')
      .then((r) => r.data.data)
      .catch(() => {
        countriesPromise = null;
        return [];
      });
  }
  return countriesPromise;
}

function fetchRegions(country: string): Promise<Named[]> {
  let p = regionsCache.get(country);
  if (!p) {
    p = api
      .get<{ data: Named[] }>('/geo/regions', { params: { country } })
      .then((r) => r.data.data)
      .catch(() => {
        regionsCache.delete(country);
        return [];
      });
    regionsCache.set(country, p);
  }
  return p;
}

/* ---------- the pieces ---------- */

/** A country select and, once one is picked, the regions inside it — "Whole country" first. */
function PlacePicker({
  label,
  countries,
  value,
  onChange,
}: {
  label: string;
  countries: Named[];
  value: Place;
  onChange: (p: Place) => void;
}) {
  /* kept with the country it was fetched for, so a change of country never shows the old
     country's regions while the new list is on its way */
  const [loaded, setLoaded] = useState<{ country: string; list: Named[] }>({ country: '', list: [] });
  const regions = loaded.country === value.country ? loaded.list : [];

  useEffect(() => {
    if (!value.country) return;
    let live = true;
    void fetchRegions(value.country).then((list) => {
      if (live) setLoaded({ country: value.country, list });
    });
    return () => {
      live = false;
    };
  }, [value.country]);

  return (
    <div className="form-row">
      <div className="form-group col-sm-7 mb-2">
        <label className="small text-uppercase text-muted font-weight-bold mb-1">{label}</label>
        <select
          className="custom-select"
          value={value.country}
          onChange={(e) => onChange({ country: e.target.value, region: null })}
          required
        >
          <option value="">Choose a country…</option>
          {countries.map((c) => (
            <option key={c.iso2} value={c.iso2}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="form-group col-sm-5 mb-2">
        <label className="small text-uppercase text-muted font-weight-bold mb-1">Region</label>
        <select
          className="custom-select"
          value={value.region ?? ''}
          onChange={(e) => onChange({ country: value.country, region: e.target.value || null })}
          disabled={!value.country || regions.length === 0}
        >
          <option value="">Whole country</option>
          {regions.map((r) => (
            <option key={r.iso2} value={r.iso2}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/** The figure, with the % sign on the box so nobody wonders whether it is a fraction. */
function PercentField({
  value,
  onChange,
  size,
}: {
  value: string;
  onChange: (v: string) => void;
  size?: 'sm';
}) {
  const sm = size === 'sm';
  return (
    <div className={`input-group${sm ? ' input-group-sm' : ''}`} style={{ width: sm ? 110 : 140 }}>
      <input
        type="number"
        min={0}
        max={100}
        step={1}
        className="form-control"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0–100"
        required
      />
      <div className="input-group-append">
        <span className="input-group-text">%</span>
      </div>
    </div>
  );
}

/**
 * The account, chosen from the accounts that exist. Types go to the same search the user
 * panel's own box uses, and the suggestions are drawn with the site's typeahead list — the
 * one under "Search Influencer" — so it looks like the rest of the site's picking.
 */
function UserPicker({ picked, onPick }: { picked: PickedUser | null; onPick: (u: PickedUser | null) => void }) {
  const [text, setText] = useState('');
  const [hits, setHits] = useState<PickedUser[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  function type(value: string) {
    setText(value);
    onPick(null); /* typing again un-picks — the rule must name somebody from the list */
    if (timer.current) clearTimeout(timer.current);
    if (!value.trim()) {
      setHits([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(() => {
      api
        .get<{ users: PickedUser[] }>(`/admin/all-users?search=${encodeURIComponent(value.trim())}`)
        .then((r) => {
          /* The search answers in id order and matches anywhere in the email too, so the
             account actually being typed could sit past the eighth row. Closest first:
             username beginning with the term, then email, then the rest as they came. */
          const term = value.trim().toLowerCase();
          const rank = (u: PickedUser) =>
            u.usernameUrl.toLowerCase().startsWith(term) ? 0 : u.email.toLowerCase().startsWith(term) ? 1 : 2;
          const sorted = r.data.users.map((u, i) => ({ u, i })).sort((a, b) => rank(a.u) - rank(b.u) || a.i - b.i);
          setHits(sorted.slice(0, 8).map((x) => x.u)); /* the site's list shows eight, as the blades' plugin does */
          setOpen(true);
        })
        .catch(() => setHits([]));
    }, 250);
  }

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <div className="input-group">
        <div className="input-group-prepend">
          <span className="input-group-text">@</span>
        </div>
        <input
          type="text"
          className={`form-control${picked ? ' is-valid' : ''}`}
          placeholder="Start typing a username or email…"
          value={picked ? picked.usernameUrl : text}
          onChange={(e) => type(e.target.value)}
          onFocus={() => hits.length > 0 && !picked && setOpen(true)}
          autoComplete="off"
        />
        {picked && (
          <div className="input-group-append">
            <button type="button" className="btn btn-outline-secondary" onClick={() => { onPick(null); setText(''); }} title="Clear">
              &times;
            </button>
          </div>
        )}
      </div>
      {picked && <small className="form-text text-muted">{picked.email} · {picked.role}</small>}
      {open && hits.length > 0 && (
        <ul className="typeahead dropdown-menu" style={{ display: 'block', top: '100%', left: 0, right: 0, zIndex: 1000 }}>
          {hits.map((hit) => (
            <li key={hit.id}>
              <button
                type="button"
                className="dropdown-item reach-hit"
                onClick={() => {
                  setOpen(false);
                  setText(hit.usernameUrl);
                  onPick(hit);
                }}
              >
                <span className="dropdown-item-name">
                  <b>@{hit.usernameUrl}</b>
                  <span className="reach-hit-email">{hit.email}</span>
                </span>
                <span className="badge badge-light ml-auto">{hit.role}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && hits.length === 0 && text.trim() && !picked && (
        <small className="form-text text-muted">No account matches “{text.trim()}”.</small>
      )}
    </div>
  );
}

/** A place as the table prints it: the country by name, the region by name where there is one. */
function placeText(p: Place | null, countries: Map<string, string>, regions: Map<string, string>): string {
  if (!p) return '—';
  const country = countries.get(p.country) ?? p.country;
  if (!p.region) return country;
  return `${country} · ${regions.get(`${p.country}/${p.region}`) ?? p.region}`;
}

/** One rule in either table, with its figure editable in place. */
function LockRow({
  lock,
  countries,
  regions,
  onFlash,
  onSaved,
  onRemoved,
}: {
  lock: Lock;
  countries: Map<string, string>;
  regions: Map<string, string>;
  onFlash: (f: Flash) => void;
  onSaved: (l: Lock) => void;
  onRemoved: (id: string) => void;
}) {
  const [percent, setPercent] = useState(String(lock.percent));
  const [busy, setBusy] = useState(false);
  const changed = percent !== String(lock.percent);

  async function save() {
    setBusy(true);
    try {
      const r = await api.put<{ lock: Lock }>(`/admin/reach-locks/${lock.id}`, { percent });
      onSaved(r.data.lock);
      onFlash({ kind: 'success', text: 'Lock updated.' });
    } catch (err) {
      onFlash({ kind: 'danger', text: errorText(err) });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm('Remove this lock?')) return;
    setBusy(true);
    try {
      await api.delete(`/admin/reach-locks/${lock.id}`);
      onRemoved(lock.id);
      onFlash({ kind: 'success', text: 'Lock removed.' });
    } catch (err) {
      onFlash({ kind: 'danger', text: errorText(err) });
      setBusy(false);
    }
  }

  const tone = lock.percent === 0 ? 'danger' : lock.percent === 100 ? 'success' : 'primary';

  return (
    <tr>
      {lock.kind === 'user' ? (
        <td>
          {lock.user ? (
            <>
              <b>@{lock.user.usernameUrl}</b>
              <br />
              <small className="text-muted">{lock.user.email}</small>
            </>
          ) : (
            <span className="text-muted font-italic">deleted account</span>
          )}
        </td>
      ) : (
        <td>{placeText(lock.from, countries, regions)}</td>
      )}
      <td>{placeText(lock.to, countries, regions)}</td>
      <td>
        <div className="d-flex align-items-center">
          {/* Bootstrap 4.0 has no flex-grow utility yet — it came in 4.1 — so the growth is inline */}
          <div className="progress mr-3" style={{ flex: '1 1 auto', height: 8, minWidth: 80 }} title={`${lock.percent}%`}>
            <div className={`progress-bar bg-${tone}`} style={{ width: `${lock.percent}%` }} />
          </div>
          <PercentField value={percent} onChange={setPercent} size="sm" />
        </div>
      </td>
      <td className="text-nowrap">
        <button type="button" className="btn btn-success btn-sm mr-1" disabled={busy || !changed} onClick={() => void save()}>
          Save
        </button>
        <button type="button" className="btn btn-outline-danger btn-sm" disabled={busy} onClick={() => void remove()}>
          Remove
        </button>
      </td>
    </tr>
  );
}

/** One of the two lockers: its card, its form, its table. */
function LockerCard({
  title,
  blurb,
  count,
  form,
  columns,
  rows,
  empty,
}: {
  title: string;
  blurb: string;
  count: number;
  form: ReactNode;
  columns: [string, string];
  rows: ReactNode;
  empty: string;
}) {
  return (
    <div className="card mb-4">
      <div className="card-header bg-dark text-white d-flex align-items-center">
        <h5 className="mb-0">{title}</h5>
        <span className="badge badge-light ml-3">{count} {count === 1 ? 'rule' : 'rules'}</span>
      </div>
      <div className="card-body">
        <p className="text-muted mb-3">{blurb}</p>
        {form}
      </div>
      <table className="table table-striped table-bordered mb-0">
        <thead>
          <tr className="bg-dark text-white">
            <th style={{ width: '28%' }}>{columns[0]}</th>
            <th style={{ width: '28%' }}>{columns[1]}</th>
            <th>Reach</th>
            <th style={{ width: 150 }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {count === 0 ? (
            <tr>
              <td colSpan={4} className="text-muted font-italic py-3">
                {empty}
              </td>
            </tr>
          ) : (
            rows
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- the page ---------- */

export function ReachLocks() {
  useStandalonePageStyles([BOOTSTRAP4_CDN]);
  const [locks, setLocks] = useState<Lock[]>([]);
  const [countries, setCountries] = useState<Named[]>([]);
  /* region names for the codes the table shows, keyed "ES/CT" */
  const [regionNames, setRegionNames] = useState<Map<string, string>>(new Map());
  const [flash, setFlash] = useState<Flash>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'denied'>('loading');

  /* the zone form */
  const [from, setFrom] = useState<Place>(EMPTY_PLACE);
  const [to, setTo] = useState<Place>(EMPTY_PLACE);
  const [zonePercent, setZonePercent] = useState('');
  /* the user form */
  const [who, setWho] = useState<PickedUser | null>(null);
  /* bumped after a save so the picker is remounted empty — its typed text is its own */
  const [pickerKey, setPickerKey] = useState(0);
  const [userTo, setUserTo] = useState<Place>(EMPTY_PLACE);
  const [userPercent, setUserPercent] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = 'Superfans | Country Locker';
  }, []);

  useEffect(() => {
    api
      .get<{ locks: Lock[] }>('/admin/reach-locks')
      .then((r) => {
        setLocks(r.data.locks);
        setState('ok');
      })
      .catch(() => setState('denied'));
    void fetchCountries().then(setCountries);
  }, []);

  /* the table names regions rather than printing their codes — fetch the lists for whatever
     countries the rules mention, once each */
  useEffect(() => {
    const wanted = new Set<string>();
    for (const l of locks) {
      if (l.from?.region) wanted.add(l.from.country);
      if (l.to.region) wanted.add(l.to.country);
    }
    let live = true;
    void Promise.all([...wanted].map(async (c) => [c, await fetchRegions(c)] as const)).then((lists) => {
      if (!live) return;
      setRegionNames((prev) => {
        const next = new Map(prev);
        for (const [c, list] of lists) for (const r of list) next.set(`${c}/${r.iso2}`, r.name);
        return next;
      });
    });
    return () => {
      live = false;
    };
  }, [locks]);

  const countryNames = new Map(countries.map((c) => [c.iso2, c.name]));

  function upsert(saved: Lock) {
    setLocks((prev) => (prev.some((l) => l.id === saved.id) ? prev.map((l) => (l.id === saved.id ? saved : l)) : [...prev, saved]));
  }

  async function submit(e: FormEvent, body: Record<string, unknown>, done: () => void) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post<{ lock: Lock }>('/admin/reach-locks', body);
      upsert(r.data.lock);
      setFlash({ kind: 'success', text: 'Lock saved.' });
      done();
    } catch (err) {
      setFlash({ kind: 'danger', text: errorText(err) });
    } finally {
      setBusy(false);
    }
  }

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

  const zoneLocks = locks.filter((l) => l.kind === 'zone');
  const userLocks = locks.filter((l) => l.kind === 'user');
  const rowProps = { countries: countryNames, regions: regionNames, onFlash: setFlash, onSaved: upsert, onRemoved: (id: string) => setLocks((prev) => prev.filter((x) => x.id !== id)) };

  return (
    <div className="container-fluid my-4 w-100 reach-locks">
      <style>{`
        /* the arrow between "posts from" and "shown in", on the form's own baseline */
        .reach-locks .reach-arrow { font-size: 28px; line-height: 38px; color: #6c757d; padding-top: 22px; text-align: center; }
        @media (max-width: 767px) { .reach-locks .reach-arrow { display: none; } }
        /* the suggestion rows: the site's list, with the email beside the name */
        .reach-locks .typeahead .reach-hit { font-size: 14px; padding: 6px 12px; }
        .reach-locks .reach-hit-email { margin-left: 8px; opacity: .7; }
        .reach-locks .typeahead .dropdown-item:hover .badge { background: #fff; }
      `}</style>

      <div className="d-flex justify-content-between align-items-end flex-wrap mb-3">
        <div>
          <h3 className="mb-1">Country Locker</h3>
          <div className="text-muted">Where posts are shown beyond the country they were made in.</div>
        </div>
        <a className="btn btn-outline-secondary btn-sm" href="/influencer/all_users">
          &larr; All Users
        </a>
      </div>

      {flash && (
        <div className={`alert alert-${flash.kind} alert-dismissible fade show`} role="alert">
          <b>{flash.text}</b>
          <button type="button" className="close" aria-label="Close" onClick={() => setFlash(null)}>
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
      )}

      <LockerCard
        title="Country Zone Post Locker"
        blurb='Posts made in the first place are shown in the second at this reach. Leave the region on "Whole country" to cover all of it. 0 hides them there, 100 shows them all; anything between is each post’s chance of appearing. A rule for a region outranks one for the whole country.'
        count={zoneLocks.length}
        columns={['Posts from', 'Shown in']}
        empty="No zone locks yet — posts reach other countries only as far as their authors have earned."
        form={
          <form
            onSubmit={(e) =>
              void submit(e, { kind: 'zone', from, to, percent: zonePercent }, () => {
                setZonePercent('');
              })
            }
          >
            <div className="form-row align-items-start">
              <div className="col-md-5">
                <PlacePicker label="Posts from" countries={countries} value={from} onChange={setFrom} />
              </div>
              <div className="col-md-1 reach-arrow">&rarr;</div>
              <div className="col-md-5">
                <PlacePicker label="Shown in" countries={countries} value={to} onChange={setTo} />
              </div>
            </div>
            <div className="d-flex align-items-end flex-wrap mt-1">
              <div className="form-group mb-2 mr-3">
                <label className="small text-uppercase text-muted font-weight-bold mb-1">Reach</label>
                <PercentField value={zonePercent} onChange={setZonePercent} />
              </div>
              <div className="form-group mb-2">
                <button type="submit" className="btn btn-primary" disabled={busy || !from.country || !to.country}>
                  Save lock
                </button>
              </div>
            </div>
          </form>
        }
        rows={zoneLocks.map((l) => (
          <LockRow key={l.id} lock={l} {...rowProps} />
        ))}
      />

      <LockerCard
        title="User Individual Locker Country"
        blurb="One account’s posts, shown in a place at this reach — wherever they were posted from. A user lock outranks any zone lock."
        count={userLocks.length}
        columns={['User', 'Shown in']}
        empty="No user locks yet."
        form={
          <form
            onSubmit={(e) =>
              void submit(e, { kind: 'user', user: who?.id, to: userTo, percent: userPercent }, () => {
                setWho(null);
                setPickerKey((k) => k + 1);
                setUserPercent('');
              })
            }
          >
            <div className="form-row align-items-start">
              <div className="col-md-5">
                <div className="form-group mb-2">
                  <label className="small text-uppercase text-muted font-weight-bold mb-1">Account</label>
                  <UserPicker key={pickerKey} picked={who} onPick={setWho} />
                </div>
              </div>
              <div className="col-md-1 reach-arrow">&rarr;</div>
              <div className="col-md-5">
                <PlacePicker label="Shown in" countries={countries} value={userTo} onChange={setUserTo} />
              </div>
            </div>
            <div className="d-flex align-items-end flex-wrap mt-1">
              <div className="form-group mb-2 mr-3">
                <label className="small text-uppercase text-muted font-weight-bold mb-1">Reach</label>
                <PercentField value={userPercent} onChange={setUserPercent} />
              </div>
              <div className="form-group mb-2">
                <button type="submit" className="btn btn-primary" disabled={busy || !who || !userTo.country}>
                  Save lock
                </button>
              </div>
            </div>
          </form>
        }
        rows={userLocks.map((l) => (
          <LockRow key={l.id} lock={l} {...rowProps} />
        ))}
      />
    </div>
  );
}
