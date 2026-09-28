import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Trans, useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { assetImage } from '../utils/format';
import '../styles/notifications.css';

/**
 * The bell on the phone's bottom bar and the panel it opens.
 *
 * No Laravel original — the feature is the client's own (28 Sep 2026), so the order and the
 * wording follow his notes rather than a blade:
 *
 *   1. Anuncios      — pinned. An active ad in miniature, or the invitation to make one.
 *   2. Partner       — pinned. "we can put it under the Ads, at 2nd position."
 *   3. by date       — Hoy / Ayer / Ultimos 7 dias / Este mes / Anteriores.
 *
 * The server hands back plain rows with their timestamps; the grouping into those buckets is
 * done here because it depends on the reader's own clock, not the server's.
 */

interface Actor {
  id: string;
  usernameUrl: string | null;
  name: string | null;
  profilePicture: string | null;
}

type Item =
  | {
      kind: 'like';
      id: string;
      at: string;
      postId: string;
      media: 'picture' | 'video';
      thumb: string | null;
      actors: Actor[];
      others: number;
    }
  | { kind: 'follow' | 'subscribe' | 'card'; id: string; at: string; actor: Actor };

interface PartnerRow {
  id: string;
  at: string;
  business: Actor;
}

interface Payload {
  unread: number;
  ads: { active: { id: string; adType: string; media: string | null } | null };
  partner: PartnerRow[];
  items: Item[];
  hasMore: boolean;
}

const AVATAR_FALLBACK = 'output-onlinepngtools (2).png';

function avatar(a: Actor): string {
  return a.profilePicture ? assetImage(a.profilePicture) : assetImage(AVATAR_FALLBACK);
}

/** The client's own stamps: 30min, 7h, 4d. Anything under a minute reads as "now". */
function useRelative() {
  const { t } = useTranslation('ui');
  return (iso: string) => {
    const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (secs < 60) return t('notif_now');
    if (secs < 3600) return `${Math.floor(secs / 60)}min`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
    return `${Math.floor(secs / 86400)}d`;
  };
}

type Bucket = 'today' | 'yesterday' | 'week' | 'month' | 'older';

/** Which of the client's five date groups a row belongs to, by the reader's own calendar. */
function bucketOf(iso: string): Bucket {
  const at = new Date(iso);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const day = 86400000;
  if (at >= startOfToday) return 'today';
  if (at >= new Date(startOfToday.getTime() - day)) return 'yesterday';
  if (at >= new Date(startOfToday.getTime() - 7 * day)) return 'week';
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  if (at >= startOfMonth) return 'month';
  return 'older';
}

const BUCKET_ORDER: Bucket[] = ['today', 'yesterday', 'week', 'month', 'older'];
const BUCKET_KEY: Record<Bucket, string> = {
  today: 'notif_group_today',
  yesterday: 'notif_group_yesterday',
  week: 'notif_group_week',
  month: 'notif_group_month',
  older: 'notif_group_older',
};

export function NotificationsBell({ variant = 'bar' }: { variant?: 'bar' | 'sidebar' }) {
  const { user } = useAuth();
  const { t } = useTranslation('ui');
  const navigate = useNavigate();
  const relative = useRelative();

  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(false);
  const [reviewing, setReviewing] = useState<PartnerRow | null>(null);
  /* how tall the bar under the sheet actually is, so the two meet with nothing showing
     between them — see the note on .notif-sheet */
  const [barHeight, setBarHeight] = useState(62);
  /* on a desktop the bell lives in the left column, so the sheet opens beside it rather than
     over it — measured, because that column is not one fixed width */
  const [asideWidth, setAsideWidth] = useState(0);

  const load = useCallback(() => {
    api
      .get<{ success: boolean; data: Payload }>('/notifications')
      .then((r) => setData(r.data.data))
      .catch(() => undefined);
  }, []);

  /* One fetch when the bar mounts: it carries the unread count the bell needs anyway, so the
     panel is already filled by the time it is opened. */
  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (!user) return null;

  function openPanel() {
    const bar = document.querySelector('.mobile-footer-menu');
    if (bar) setBarHeight(Math.round(bar.getBoundingClientRect().height));
    const aside = document.querySelector('#fh5co-aside');
    setAsideWidth(aside ? Math.round(aside.getBoundingClientRect().width) : 0);
    setOpen(true);
    /* everything up to now stops counting — the badge clears here rather than waiting for
       the round trip, which is what makes the tap feel answered */
    setData((d) => (d ? { ...d, unread: 0 } : d));
    void api.post('/notifications/seen').catch(() => undefined);
  }

  function loadMore() {
    if (!data || loading) return;
    const oldest = data.items[data.items.length - 1]?.at;
    if (!oldest) return;
    setLoading(true);
    api
      .get<{ success: boolean; data: Payload }>(`/notifications?before=${encodeURIComponent(oldest)}`)
      .then((r) =>
        setData((d) =>
          d ? { ...d, items: [...d.items, ...r.data.data.items], hasMore: r.data.data.hasMore } : d,
        ),
      )
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }

  /* "Yes, we should open the actioned Post" — a like leads to the post it was left on. A
     follow, a subscription or a card has no post behind it, so those open the person. */
  function openItem(item: Item) {
    setOpen(false);
    if (item.kind === 'like') {
      navigate(`/user/post_detail/${item.postId}`);
      return;
    }
    if (item.actor.usernameUrl) navigate(`/${item.actor.usernameUrl}`);
  }

  async function answer(request: PartnerRow, accept: boolean) {
    try {
      await api.post(`/notifications/partner/${request.id}/${accept ? 'accept' : 'decline'}`);
    } catch {
      /* the row goes either way: an answer that did not land is not worth stranding the
         panel on, and the next open re-reads the truth from the server */
    }
    setReviewing(null);
    setData((d) => (d ? { ...d, partner: d.partner.filter((p) => p.id !== request.id) } : d));
  }

  const unread = data?.unread ?? 0;

  function row(item: Item) {
    const when = <span className="notif-when"> {relative(item.at)}</span>;
    if (item.kind === 'like') {
      /* "A martinherrada, hugo_guti, maria.92, y 11 personas mas les ha gustado tu video."
         — the client's own line. No @ in front of the names, the bold stops where the names
         do, and the verb agrees with how many people liked it, which is why the sentence is
         a plural key rather than a phrase glued together here. */
      const names = item.actors.map((a) => a.usernameUrl ?? '?').join(', ');
      /* kept out of the bold: the mock emphasises the names and lets the rest read plainly */
      const more = item.others > 0 ? `, ${t('notif_others', { count: item.others })}` : '';
      const likers = item.actors.length + item.others;
      return (
        <button className="notif-row" key={item.id} onClick={() => openItem(item)}>
          <img className="notif-avatar" src={avatar(item.actors[0])} alt="" />
          <span className="notif-text">
            <Trans
              i18nKey={item.media === 'video' ? 'notif_liked_video' : 'notif_liked_picture'}
              ns="ui"
              count={likers}
              values={{ names, more }}
              components={{ b: <b /> }}
            />
            {when}
          </span>
          {item.thumb && <img className="notif-thumb" src={assetImage(item.thumb)} alt="" />}
        </button>
      );
    }
    const line =
      item.kind === 'follow'
        ? 'notif_followed'
        : item.kind === 'subscribe'
          ? 'notif_subscribed'
          : 'notif_card';
    return (
      <button className="notif-row" key={item.id} onClick={() => openItem(item)}>
        <img className="notif-avatar" src={avatar(item.actor)} alt="" />
        <span className="notif-text">
          <b>@{item.actor.usernameUrl ?? '?'}</b> {t(line)}
          {when}
        </span>
      </button>
    );
  }

  const byBucket = new Map<Bucket, Item[]>();
  for (const item of data?.items ?? []) {
    const b = bucketOf(item.at);
    const list = byBucket.get(b);
    if (list) list.push(item);
    else byBucket.set(b, [item]);
  }

  return (
    <>
      {variant === 'sidebar' ? (
        /* In the left column it reads as one more of the panel's entries — the client asked
           for the bell there on the desktop, where the phone's bar does not exist. */
        <p className="dropdown-item notif-sidebar-item" onClick={openPanel}>
          <i className="fa fa-bell" aria-hidden="true"></i> {t('notif_title')}
          {unread > 0 && <span className="notif-badge">{unread > 99 ? '99+' : unread}</span>}
        </p>
      ) : (
        <div
          className="footer-btn-square notif-bell"
          onClick={openPanel}
          style={{ cursor: 'pointer' }}
          role="button"
          aria-label={t('notif_title')}
        >
          <i className="fa fa-bell" aria-hidden="true"></i>
          {unread > 0 && <span className="notif-badge">{unread > 99 ? '99+' : unread}</span>}
        </div>
      )}

      {/* The sheet, the scrim and the modal are sent to <body> rather than drawn where the
          bell sits. On the desktop the bell is inside #fh5co-aside, which is position:fixed —
          and a fixed element opens its own stacking context, so everything inside it is
          sealed under that one level however high its z-index climbs. The panel was painting
          at 123121 and the wall's post images were still landing on top of it. */}
      {open &&
        createPortal(
          <>
            <div className="notif-scrim" onClick={() => setOpen(false)} />
          <div
            className="notif-sheet"
            style={
              {
                ['--notif-bar-height' as string]: `${barHeight}px`,
                ['--notif-aside-width' as string]: `${asideWidth}px`,
              } as CSSProperties
            }
          >
            <div className="notif-head">
              <span>{t('notif_title')}</span>
              <button className="notif-close" onClick={() => setOpen(false)} aria-label={t('close')}>
                ▾
              </button>
            </div>

            <div className="notif-body">
              {/* 1st position — announcements. The client's mock puts the call to action up on
                  the heading's own line, with the state of things reading underneath it. */}
              <div className="notif-group notif-group-row">
                <span>🚀 {t('notif_ads_title')}</span>
                {!data?.ads.active && (
                  <button
                    className="notif-cta notif-cta-promote"
                    onClick={() => {
                      setOpen(false);
                      navigate('/super-ads');
                    }}
                  >
                    {t('notif_ads_promote')}
                  </button>
                )}
              </div>
              {data?.ads.active ? (
                <button
                  className="notif-row"
                  onClick={() => {
                    setOpen(false);
                    navigate('/super-ads/my-ads');
                  }}
                >
                  <span className="notif-text">
                    {t('notif_ads_active', { type: data.ads.active.adType })}
                  </span>
                  {data.ads.active.media && (
                    <img className="notif-thumb" src={assetImage(data.ads.active.media)} alt="" />
                  )}
                </button>
              ) : (
                <div className="notif-row is-static">
                  <span className="notif-text">{t('notif_ads_none')}</span>
                </div>
              )}

              {/* 2nd position — the client put partner requests here, above the dated groups */}
              {(data?.partner.length ?? 0) > 0 && (
                <>
                  <div className="notif-group">🧷 {t('notif_partner_title')}</div>
                  {data!.partner.map((p) => (
                    <div className="notif-row is-static" key={p.id}>
                      <img className="notif-avatar" src={avatar(p.business)} alt="" />
                      <span className="notif-text">
                        {t('notif_partner_text', { name: p.business.name ?? p.business.usernameUrl ?? t('notif_business') })}
                        <span className="notif-when"> {relative(p.at)}</span>
                      </span>
                      <button className="notif-cta notif-cta-review" onClick={() => setReviewing(p)}>
                        {t('notif_partner_review')}
                      </button>
                    </div>
                  ))}
                </>
              )}

              {/* then everything else, by date */}
              {BUCKET_ORDER.filter((b) => byBucket.has(b)).map((b) => (
                <div key={b}>
                  <div className="notif-group">
                    {b === 'month' || b === 'older' ? '📅' : '🕚'} {t(BUCKET_KEY[b])}
                  </div>
                  {byBucket.get(b)!.map(row)}
                </div>
              ))}

              {data && data.items.length === 0 && (data.partner.length ?? 0) === 0 && (
                <div className="notif-empty">{t('notif_empty')}</div>
              )}

              {data?.hasMore && (
                <button className="notif-more" onClick={loadMore} disabled={loading}>
                  {loading ? t('loading') : t('notif_more')}
                </button>
              )}
            </div>
          </div>
          </>,
          document.body,
        )}

      {/* the client's purple modal, with his two buttons — portalled for the same reason */}
      {reviewing &&
        createPortal(
        <div
          className="modal"
          style={{
            zIndex: 123123,
            display: 'block',
            position: 'fixed',
            inset: 0,
            overflowY: 'auto',
            background: 'rgba(0,0,0,0.5)',
          }}
          onClick={() => setReviewing(null)}
        >
          <div
            className="modal-dialog modal-dialog-centered"
            style={{ margin: '30px auto', maxWidth: 420 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="modal-content"
              style={{ borderRadius: 20, background: '#8a2be2', padding: 24, color: '#fff' }}
            >
              <h4 style={{ margin: '0 0 10px', fontWeight: 800 }}>🧷 {t('notif_partner_title')}</h4>
              <p style={{ margin: '0 0 20px', lineHeight: 1.45 }}>
                {t('notif_partner_text', {
                  name: reviewing.business.name ?? reviewing.business.usernameUrl ?? t('notif_business'),
                })}
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  className="notif-cta"
                  style={{ background: '#fff', color: '#8a2be2', padding: '9px 18px', border: '1px solid rgba(0,0,0,0.35)' }}
                  onClick={() => void answer(reviewing, false)}
                >
                  {t('notif_decline')}
                </button>
                <button
                  className="notif-cta"
                  style={{ background: '#21c063', color: '#fff', padding: '9px 18px', border: '1px solid #148c46' }}
                  onClick={() => void answer(reviewing, true)}
                >
                  {t('notif_accept')}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
