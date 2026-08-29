import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import { AdCard, AD_ACTION_LABEL, adAction, type AdCardItem } from '../../components/AdCard';
import { PageLoader } from '../../components/PageLoader';
import '../../styles/ad-card.css';

/**
 * Every Super Ad in the system, on one wall.
 *
 * The World feed deals ads in among the posts a handful at a time, so there was no way to
 * look at them — to see how each type actually appears, or which ones are missing artwork
 * or a link. This is that page: the World's own grid and the World's own tile, with the
 * posts left out. Nothing here is filtered on approved or running, because the point is to
 * see everything that exists.
 */

interface PreviewAd extends AdCardItem {
  status: boolean;
  approved: boolean;
}

/* Every type the system can sell — the thirteen in the backend's AD_TYPES. Two of them,
   calls and messages, have never been bought, so no real ad exists to look at; the samples
   row below draws one of each so the page can still answer "what will this look like".
   (The Ads Center's fourteenth card, Super Video, is sold as website-visits and so is not a
   type of its own.) */
const ALL_TYPES = [
  'promote-post', 'profile-followers', 'messages', 'instagram', 'tiktok', 'twitch',
  'youtube', 'amazon', 'spotify', 'website-visits', 'calls', 'whatsapp',
  'clients-form',
];

export function AdsPreview() {
  const [ads, setAds] = useState<PreviewAd[] | null>(null);
  /* ads left out because their artwork is not on the server */
  const [hidden, setHidden] = useState(0);
  const [type, setType] = useState<string>('all');
  const [samples, setSamples] = useState(false);

  useEffect(() => {
    document.title = 'Superfans | All Ads Preview';
    api
      .get<{ ads: PreviewAd[]; hidden: number }>('/ads/preview')
      .then((r) => {
        setAds(r.data.ads);
        setHidden(r.data.hidden ?? 0);
      })
      .catch(() => setAds([]));
  }, []);

  /* one entry per type actually present, with its count — the filter doubles as the tally */
  const types = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of ads ?? []) {
      const key = a.adType ?? 'no type';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [ads]);

  const shown = useMemo(
    () => (ads ?? []).filter((a) => type === 'all' || (a.adType ?? 'no type') === type),
    [ads, type],
  );

  /* one made-up tile per type, borrowing a real ad's artwork so the tile is not empty. The
     clients-form sample is left out: that tile needs a real form behind it. */
  const sampleTiles = useMemo(() => {
    const art = (ads ?? []).find((a) => a.media && !a.media.match(/\.(mp4|mov|webm)$/i))?.media;
    return ALL_TYPES.filter((t) => t !== 'clients-form').map((t) => ({
      id: `sample-${t}`,
      media: art,
      /* the same shape the Ads Center writes for each type */
      link:
        t === 'calls' ? 'tel:+34600123456'
        : t === 'whatsapp' ? 'https://wa.me/34600123456'
        : 'https://example.com',
      adType: t,
      advertiser: { usernameUrl: 'martinherrada', name: 'Sample advertiser' },
      status: true,
      approved: true,
    })) as PreviewAd[];
  }, [ads]);

  if (!ads) return <PageLoader />;

  return (
    <div id="fh5co-main">
      <div className="fh5co-narrow-content ads-preview-grid">
        <center>
          <h2 style={{ fontWeight: 800, marginBottom: 4 }}>📢 All Super Ads</h2>
          <p style={{ color: '#666', fontSize: 14 }}>
            Every ad in the system, drawn with the same tile the World feed uses —{' '}
            <b>{ads.length}</b> in total.
            {hidden > 0 && (
              <>
                {' '}
                <span style={{ color: '#b00' }}>
                  ({hidden} hidden — their image or video is not on the server)
                </span>
              </>
            )}
          </p>

          {/* the tally, which is also the filter */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              justifyContent: 'center',
              margin: '14px 0 22px',
            }}
          >
            <TypeChip label={`all (${ads.length})`} on={type === 'all'} onClick={() => setType('all')} />
            <TypeChip
              label={samples ? '✓ samples of every type' : 'samples of every type'}
              on={samples}
              onClick={() => setSamples((v) => !v)}
            />
            {types.map(([name, n]) => (
              <TypeChip
                key={name}
                label={`${name} (${n})`}
                on={type === name}
                onClick={() => setType(name)}
              />
            ))}
          </div>
        </center>

        {/* One of every type, drawn from nothing — three types have never been bought, so
            this is the only way to see their buttons. */}
        {samples && (
          <>
            <h5 style={{ fontWeight: 800, marginBottom: 10 }}>
              Samples — one of every type (not real ads)
            </h5>
            <div className="row animate-box" style={{ display: 'block', flexWrap: 'wrap' }}>
              <div id="post-container">
                {sampleTiles.map((ad) => (
                  <AdCard key={ad.id} item={ad} showType />
                ))}
              </div>
            </div>
            <div style={{ clear: 'both', height: 30 }} />
          </>
        )}

        {/* the World's own row/col grid, so a tile sits exactly where it would there */}
        <div className="row animate-box" style={{ display: 'block', flexWrap: 'wrap' }}>
          {shown.length > 0 ? (
            <div id="post-container">
              {shown.map((ad) => (
                <div key={ad.id} style={{ display: 'contents' }}>
                  <AdCard item={ad} showType />
                </div>
              ))}
            </div>
          ) : (
            <p style={{ textAlign: 'center', marginTop: 40 }}>No ads of this type.</p>
          )}
        </div>

        {/* what each button on a tile would do, so the page explains itself */}
        <div style={{ clear: 'both', marginTop: 40, paddingTop: 20, borderTop: '1px solid #eee' }}>
          <h5 style={{ fontWeight: 800 }}>What the buttons do</h5>
          <ul style={{ color: '#555', fontSize: 13, lineHeight: 1.9 }}>
            <li>
              <b>{AD_ACTION_LABEL[adAction('calls')]}</b> — dials the advertiser's number
              (<code>tel:</code>), on <code>calls</code> ads
            </li>
            <li>
              <b>{AD_ACTION_LABEL[adAction('whatsapp')]}</b> — opens wa.me, on{' '}
              <code>whatsapp</code> ads
            </li>
            <li>
              <b>{AD_ACTION_LABEL[adAction('profile-followers')]}</b> — goes to the advertiser's
              profile, on <code>profile-followers</code> ads
            </li>
            <li>
              <b>{AD_ACTION_LABEL[adAction('youtube')]}</b> — goes to the advertiser's profile,
              on <code>youtube</code> ads (card 7, "Promote Youtube Content")
            </li>
            <li>
              <b>{AD_ACTION_LABEL[adAction('messages')]}</b> — on <code>messages</code> ads.{' '}
              <i>Waiting on the client: what this should actually send.</i>
            </li>
            <li>
              <b>{AD_ACTION_LABEL[adAction('website-visits')]}</b> — opens the ad's own link;
              every other type
            </li>
            <li>
              <code>clients-form</code> ads keep their own tile and the advertiser's own
              wording, and open the questionnaire in place
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function TypeChip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '4px 12px',
        borderRadius: 14,
        border: `2px solid ${on ? '#8a2be2' : '#ccc'}`,
        background: on ? '#8a2be2' : '#fff',
        color: on ? '#fff' : '#333',
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}
