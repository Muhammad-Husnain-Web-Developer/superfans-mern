import { Fragment, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useStandalonePageStyles, BOOTSTRAP4_CDN } from '../../components/StandalonePage';
import { AdsSidebar } from './AdsSidebar';
import { PostForLinked } from './PostForLinked';
import { LocationPicker } from './LocationPicker';
import { CountrySelect, CitySelect } from './CountryCityFields';
import { PostPicker } from './PostPicker';
import { assetImage, isVideoFile } from '../../utils/format';
import {
  AD_ACTION_LABEL,
  AD_BUTTON_VARIANTS,
  AD_BUTTON_POSITIONS,
  AD_BUTTON_SIZES,
  OUTSIDE_LOCKED_SIZE,
  CtaMark,
  resolveAdAction,
  isPaidAdvertiser,
  type AdButtonPosition,
  type AdButtonSize,
} from '../../components/AdCard';
import '../../styles/ad-card.css';
import { PhoneField } from '../../components/PhoneField';
import { useAuth } from '../../context/AuthContext';
import { HandleMarquee } from '../../components/PostHeading';

/** The three cards that promote an existing post rather than an upload (Ads Center 1-3). */
function usesPostPickerType(adType: string): boolean {
  return adType === 'promote-post' || adType === 'profile-followers' || adType === 'messages';
}

/**
 * The advertiser's two choices, drawn on their own artwork before they pay for it. It is the
 * real button — the same classes the feed renders — inside a box the shape of a feed tile, so
 * what is shown here is what the ad will look like.
 */
function AdButtonPreview({
  src,
  isVideo,
  adType,
  size,
  position,
  buttonAction,
  advertiserPaid = false,
  buttonVariant = null,
}: {
  /** the uploaded file as a data URL, or the picked post's own media URL */
  src: string;
  isVideo: boolean;
  adType: string;
  size: AdButtonSize;
  position: AdButtonPosition;
  buttonAction: string | null;
  /** the advertiser is a creator who charges, so this ad will read Subscribe */
  advertiserPaid?: boolean;
  /** the button design ticked, on a type that offers several */
  buttonVariant?: string | null;
}) {
  const action = resolveAdAction(adType, advertiserPaid, buttonVariant);
  const label = buttonAction || AD_ACTION_LABEL[action];
  /* Nothing ticked yet on a type with a choice: every design is shown, one under the other
     with an "o" between them, the way David drew the Spotify & iTunes preview. */
  const variants = AD_BUTTON_VARIANTS[adType];
  const choices = variants && !buttonVariant ? variants : null;
  const stack = choices && (
    <div className={`ads-cta-variant-stack pos-${position}`}>
      {choices.map((v, i) => (
        <Fragment key={v}>
          {i > 0 && <span className="ads-cta-variant-or">o</span>}
          <span className={`ad-cta-btn cta-${v} size-${size}`}>
            <CtaMark action={v} />
            <span>{AD_ACTION_LABEL[v]}</span>
          </span>
        </Fragment>
      ))}
    </div>
  );
  return (
    <div className="ads-cta-preview work-item">
      <div className="ad-media">
        {src ? (
          isVideo ? (
            /* a clip is previewed as a clip. It played nowhere before: the preview drew
               every upload in an <img>, so a video came out as a broken picture and the
               advertiser could not see what they were buying. Muted and looping, because
               this is a thumbnail rather than something to watch. */
            <video
              className="img-responsive posttt-img"
              src={src}
              muted
              loop
              autoPlay
              playsInline
              controls={false}
            />
          ) : (
            <img src={src} alt="" className="img-responsive posttt-img" />
          )
        ) : (
          <div className="ads-cta-preview-empty">
            {usesPostPickerType(adType)
              ? 'Pick a post above to see it here'
              : 'Upload your media to see it here'}
          </div>
        )}
        {/* the real mark, not a stand-in: the point of the preview is to show the button
            the advertiser will actually get, and the mark is half of what it looks like */}
        {stack && position !== 'outside' && stack}
        {!stack && position !== 'outside' && (
          <span className={`ad-cta-btn cta-${action} size-${size} pos-${position}`}>
            <CtaMark action={action} />
            <span>{label}</span>
          </span>
        )}
      </div>
      {stack && position === 'outside' && <div className="ad-cta-outside-row">{stack}</div>}
      {/* `outside` stands under the creative, so the preview has to show it there too —
          drawn inside the picture it would have said the opposite of what it does */}
      {!stack && position === 'outside' && (
        <div className="ad-cta-outside-row">
          <span className={`ad-cta-btn cta-${action} pos-outside`}>
            <CtaMark action={action} />
            <span>{label}</span>
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * The promote-post preview: the picked post as it will stand, with the 👁️ and ❤️💩 a post
 * carries under it rather than a button (David's mockup, 5 Oct 2026). The tag above it says
 * which of the two "Post as" choices is ticked — both tags as an ad, only the @nickname as a
 * normal post. Not pressable: the real row lives on the post.
 */
function PromotePostPreview({
  src,
  isVideo,
  promoteAs,
  handle,
}: {
  src: string;
  isVideo: boolean;
  promoteAs: 'ad' | 'post' | null;
  handle: string | null;
}) {
  return (
    <div className="ads-cta-preview work-item">
      {/* the tags as WORLD will draw them: "Super Ads" and the @nickname in two boxes, the
          second scrolling if the name is too long for it; the @nickname alone as a post */}
      {promoteAs && (
        <div className="ads-promote-tag">
          {promoteAs === 'ad' && <span className="ads-promote-tag-box">Super Ads</span>}
          {handle && (
            <span className="ads-promote-tag-box ads-promote-tag-handle">
              <HandleMarquee handles={[{ usernameUrl: handle }]} />
            </span>
          )}
        </div>
      )}
      <div className="ad-media">
        {src ? (
          isVideo ? (
            <video className="img-responsive posttt-img" src={src} muted loop autoPlay playsInline controls={false} />
          ) : (
            <img src={src} alt="" className="img-responsive posttt-img" />
          )
        ) : (
          <div className="ads-cta-preview-empty">Pick a post above to see it here</div>
        )}
      </div>
      <div className="ads-promote-stats" aria-hidden="true">
        <span>👁️</span>
        <span>
          ❤️ <img src="/brand/caca.webp" alt="" />
        </span>
      </div>
    </div>
  );
}

/** One dashboard card — mirrors the .ad-card data attributes in ads/index.blade.php. */
interface AdCard {
  id: number;
  type: string;
  min: number;
  max: number;
  audience: number;
  /** emoji, or a logo path (starts with `/`) — drawn side by side above the title. A logo
      written `normal|hover` swaps to its light version while the card is hovered: the card
      turns black then, and a black or dark-purple logo would vanish into it. */
  icons: string[];
  title: string;
  desc: string;
}

const LOGO = '/brand/networks/scroll';

/* Order, wording and logos from David's "New SUPER ADS CENTER" screenshot (Oct 2026). The ids
   stay what the logic below keys on, so the two SUPERWORLD cards swap places without changing
   what either one does. */
const CARDS: AdCard[] = [
  { id: 2, type: 'profile-followers', min: 15, max: 5000, audience: 650000, icons: ['📢', '🦸🏻‍♀️'], title: 'More Followers on SUPERWORLD Profile', desc: 'Boost your SUPERWORLD Profile to reach more fans.' },
  { id: 1, type: 'promote-post', min: 15, max: 5000, audience: 650000, icons: ['📷', '🦸🏻‍♀️'], title: 'Promote a SUPERWORLD Post', desc: 'Boost your SUPERWORLD Content to reach more fans.' },
  { id: 3, type: 'messages', min: 15, max: 5000, audience: 150000, icons: ['✉️', '🦸🏻‍♀️'], title: 'Receive More Cards', desc: 'Button that drive users to message you in your SUPERWORLD inbox.' },
  { id: 4, type: 'instagram', min: 15, max: 5000, audience: 560000, icons: [`${LOGO}/instagram.svg`], title: 'Promote Instagram Content', desc: 'Boost your Instagram posts directly from Super Ads Center.' },
  { id: 5, type: 'tiktok', min: 15, max: 5000, audience: 560000, icons: [`${LOGO}/tiktok.svg|/brand/ads/tiktok-light.svg`], title: 'Promote TikTok Content', desc: 'Boost your TikTok posts directly from Super Ads Center.' },
  { id: 6, type: 'twitch', min: 15, max: 5000, audience: 115000, icons: [`${LOGO}/twitch.svg|/brand/ads/twitch-white.svg`], title: 'Promote Twitch Content', desc: 'Boost your Twitch streams posts directly from Super Ads Center.' },
  { id: 7, type: 'youtube', min: 15, max: 5000, audience: 560000, icons: [`${LOGO}/youtube.svg`], title: 'Promote Youtube Content', desc: 'Boost your Youtube videos directly from Super Ads Center.' },
  { id: 8, type: 'amazon', min: 15, max: 5000, audience: 920000, icons: [`${LOGO}/amazon.svg|/brand/ads/amazon-light.svg`], title: 'Get More Amazon Sales', desc: 'Drive people to visit your Amazon list' },
  { id: 15, type: 'aliexpress-temu', min: 15, max: 5000, audience: 920000, icons: ['/brand/ads/aliexpress.svg', '/brand/ads/temu.svg'], title: 'Get More AliExpress o Temu Sales', desc: 'Drive people to visit your Ali-Express and Temu list.' },
  { id: 16, type: 'ecommerce', min: 15, max: 5000, audience: 920000, icons: ['🛒'], title: 'Get More E-commerce Sales', desc: 'Drive people to visit your E-commerce or landing page' },
  { id: 9, type: 'spotify', min: 15, max: 5000, audience: 920000, icons: ['🎙️', `${LOGO}/itunes.svg`, '/brand/ads/spotify.svg'], title: 'Get More Spotify o iTunes Reproductions', desc: 'Drive people to visit your Spotify music list' },
  { id: 10, type: 'website-visits', min: 15, max: 5000, audience: 920000, icons: ['🌐', '🔗'], title: 'Get More Website Visits', desc: 'Drive people to visit your website or landing page' },
  { id: 12, type: 'whatsapp', min: 15, max: 5000, audience: 92000, icons: ['/brand/ads/whatsapp.svg'], title: 'Get More WhatsApp Messages', desc: 'Run an ad with a button that lets users send you messages on WhatsApp.' },
  { id: 11, type: 'calls', min: 15, max: 5000, audience: 75000, icons: ['📞'], title: 'Receive More Calls', desc: 'Create an ad that encourages your audience to call you directly.' },
  { id: 13, type: 'clients-form', min: 75, max: 25000, audience: 300000, icons: ['📝'], title: 'Get More Potential Clients', desc: 'Create a Formulary that collects contact details from potential clients.' },
  { id: 14, type: 'website-visits', min: 500, max: 40000, audience: 1380000, icons: ['🪄', '🎬'], title: 'Super Video', desc: 'Reproduce a full screen video. Only for big companies.' },
];

/* Where a create modal's title differs from its card: Spotify's own mockup leads with the
   two logos and drops "o iTunes" from the words. */
const MODAL_ICONS: Partial<Record<string, string[]>> = {
  spotify: ['/brand/ads/spotify.svg', `${LOGO}/itunes.svg`],
};
/* Button designs ticked by name (Spotify & iTunes, AliExpress & Temu); any design not named
   here — Amazon's three — is shown as the button itself beside its box. */
const VARIANT_NAME: Partial<Record<string, string>> = {
  itunes: 'iTunes',
  spotify: 'Spotify',
  aliexpress: 'AliExpress',
  temu: 'Temu',
};
const MODAL_TITLE: Partial<Record<string, string>> = {
  spotify: 'Get More Spotify Reproductions',
};

/* the country and city lists come from /api/geo, via data/geo */
const BUTTON_ACTIONS = ['More Info', 'Ask Offer', 'Fill Out Survey', 'Check Website'];

interface CenterData {
  role: string;
  /** set when a business is working inside an account it is linked to (Vinculación Partner) */
  actingFor?: { id: string; usernameUrl: string | null; role: string } | null;
  /** a creator who charges is subscribed to, not followed — the preview says which */
  priceOfSubscription: number | null;
  profile: Record<string, unknown> | null;
  missing: string[];
}

/**
 * Super-Ads dashboard — port of resources/views/ads/index.blade.php. The grid of ad-type
 * cards; clicking a card gates on the advertiser profile, then opens the budget/duration
 * modal with the type-specific fields. Submitting creates the ad and redirects to checkout.
 */
export function AdsCenter() {
  useStandalonePageStyles([BOOTSTRAP4_CDN, '/page-css/ads-center.css']);
  const [data, setData] = useState<CenterData | null>(null);
  const { t: tUi } = useTranslation('ui');

  const [profileOpen, setProfileOpen] = useState(false);
  const [restricted, setRestricted] = useState<{ title: string; message: string; profile?: boolean } | null>(null);
  const [superVideo, setSuperVideo] = useState(false);
  /* the VIP request behind the Super Video dialog's one button */
  const [vipBusy, setVipBusy] = useState(false);
  const [vipSent, setVipSent] = useState(false);
  const [vipError, setVipError] = useState<string | null>(null);

  async function requestVip() {
    if (vipBusy) return;
    setVipBusy(true);
    setVipError(null);
    try {
      await api.post('/ads/vip-request');
      setVipSent(true);
    } catch (err) {
      const res = (err as { response?: { data?: { message?: string } } }).response;
      setVipError(res?.data?.message ?? 'The request could not be sent. Please try again.');
    } finally {
      setVipBusy(false);
    }
  }
  const [card, setCard] = useState<AdCard | null>(null);

  /* `?as=<id>` — Administrar on a linked account opens the centre inside that account. The
     server checks the link on every call; this only carries the id. */
  const [params] = useSearchParams();
  const as = params.get('as');
  /* the other half of a link: posting on that profile, which the client put in here too */
  const [postingFor, setPostingFor] = useState(false);

  /* `/super-ads/buy/:postId` — the Boost Your Post modal's "Buy Fast Ads" button. The route
     existed but nothing read the id, so the advertiser landed on the grid and had to find the
     same post again by hand; the one thing the link was for was lost on arrival. (Laravel has
     no `buy` route at all — the blade's button 404s there — so there is nothing to match and
     this is ours to decide.) It opens the promote-post card with that post already picked. */
  const { postId: boostPostId } = useParams();
  const autoOpenedRef = useRef(false);

  useEffect(() => {
    document.title = 'Superfans | Super Ads';
    void load();
  }, [as]);

  /* once, and only after the centre's data is in: onCardClick needs it to run the same
     profile-complete and role checks a real click goes through */
  useEffect(() => {
    if (!boostPostId || autoOpenedRef.current || !data) return;
    autoOpenedRef.current = true;
    const promotePost = CARDS.find((c) => c.id === 1);
    if (promotePost) onCardClick(promotePost);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boostPostId, data]);

  async function load() {
    const { data: d } = await api.get<CenterData>(`/ads/center${as ? `?as=${encodeURIComponent(as)}` : ''}`);
    setData(d);
  }

  function onCardClick(c: AdCard) {
    if (!data) return;
    // 1) profile must be complete
    if (data.missing.length > 0) {
      setRestricted({
        title: '⚠️ Complete Your Profile',
        message:
          'You cannot create ads until you complete your required profile information.<br><br><b>Please complete your profile to continue.</b>',
        profile: true,
      });
      return;
    }
    // 2) role restrictions (13 & 11 business-only; 1,2,3 not for business)
    const role = data.role;
    if ((role === 'user' || role === 'influencer') && [13, 11].includes(c.id)) {
      setRestricted({ title: '⚠️ Only for Business Accounts', message: 'This advertising tool is restricted.<br>Only <b>Business</b> accounts can access it.' });
      return;
    }
    if (role === 'business' && [1, 2, 3].includes(c.id)) {
      setRestricted({ title: '⛔ Not for Business Accounts', message: 'This advertising tool is only available for <b>Creators & Users</b>.' });
      return;
    }
    // 3) super-video (id 14) is VIP-only
    if (c.id === 14) {
      /* a fresh dialog each time, not the last one's outcome */
      setVipSent(false);
      setVipError(null);
      setSuperVideo(true);
      return;
    }
    setCard(c);
  }

  return (
    <>
      <AdsSidebar active="center" />
      {/* Working inside someone else's account is not a state to leave unsaid: every ad made
          from here belongs to them, not to the business making it. */}
      {postingFor && data?.actingFor && (
        <PostForLinked
          targetId={data.actingFor.id}
          handle={data.actingFor.usernameUrl ?? data.actingFor.id}
          onClose={() => setPostingFor(false)}
        />
      )}
      {data?.actingFor && (
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 30,
            background: '#ffd400',
            border: '3px solid #c9a600',
            padding: '8px 14px',
            fontFamily: 'Consolas, "Courier New", monospace',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <span>
            Working inside @{data.actingFor.usernameUrl ?? data.actingFor.id} —{' '}
            {data.actingFor.role === 'influencer' ? 'Creator account' : 'User account'}
          </span>
          <button
            type="button"
            onClick={() => setPostingFor(true)}
            style={{
              marginLeft: 'auto',
              background: '#6622e5',
              color: '#fff',
              border: '3px solid #520be0',
              borderRadius: 0,
              fontWeight: 700,
              padding: '4px 14px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            + Add Post
          </button>
          <a href="/super-ads" style={{ color: '#222', textDecoration: 'underline' }}>
            Leave
          </a>
        </div>
      )}
      <div className="main">
        {data && data.missing.length > 0 && (
          <div className="redlabel">
            <h2>⚠</h2>
            <p>
              Para empezar una Campaña de Publicidad en SUPER ADS CENTER, deberás completar toda la información
              personal o de representación y fiscal. Declara si eres una persona física, empresa o agencia
              representante.
            </p>
            <a href="#" id="redlabelButton" onClick={(e) => { e.preventDefault(); setProfileOpen(true); }}>
              Configuración
            </a>
          </div>
        )}

        <div className="ad-grid">
          {CARDS.map((c) => (
            <a
              href="#"
              className="ad-card"
              key={c.id}
              onClick={(e) => {
                e.preventDefault();
                onCardClick(c);
              }}
            >
              <div className="ad-card-icons">
                {c.icons.map((icon) => {
                  if (!icon.startsWith('/')) return <span key={icon}>{icon}</span>;
                  const [normal, hover] = icon.split('|');
                  return hover ? (
                    <Fragment key={icon}>
                      <img className="icon-normal" src={normal} alt="" />
                      <img className="icon-hover" src={hover} alt="" />
                    </Fragment>
                  ) : (
                    <img key={icon} src={normal} alt="" />
                  );
                })}
              </div>
              <h4>{c.title}</h4>
              <p>{c.desc}</p>
            </a>
          ))}
        </div>
      </div>

      {profileOpen && (
        <ProfileModal
          initial={data?.profile ?? null}
          onClose={() => setProfileOpen(false)}
          onSaved={async () => {
            setProfileOpen(false);
            await load();
          }}
        />
      )}

      {restricted && (
        <div className="ads-modal-overlay" onClick={() => setRestricted(null)}>
          <div className="ads-modal-box" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ background: '#8a2be2', color: '#fff', borderRadius: 12, padding: '28px 24px', textAlign: 'center' }}>
              <h3 style={{ fontWeight: 800 }} dangerouslySetInnerHTML={{ __html: restricted.title }} />
              <p style={{ fontSize: 16 }} dangerouslySetInnerHTML={{ __html: restricted.message }} />
              <button
                className="continue-btn alert-ok"
                onClick={() => {
                  const openProfile = restricted.profile;
                  setRestricted(null);
                  if (openProfile) setProfileOpen(true);
                }}
              >
                {restricted.profile ? 'Complete Profile' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}

      {superVideo && (
        <div className="ads-modal-overlay" onClick={() => setSuperVideo(false)}>
          <div className="ads-modal-box" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ background: '#8a2be2', color: '#fff', borderRadius: '0.3rem', boxShadow: 'none', padding: '28px 24px', textAlign: 'center', position: 'relative' }}>
              {/* the cross every other dialog in this module closes with, in the same corner */}
              <button className="close-modal-btn" onClick={() => setSuperVideo(false)} aria-label={tUi('close')}>
                ✖
              </button>
              <h3 style={{ fontWeight: 700, fontSize: 26 }}>⚠️ 🪄🎬 SUPER VIDEO ADS</h3>
              <p style={{ fontSize: 17 }}>
                UPS! This tool is only available for <b>VIP Business Accounts</b>. Become a VIP to activate Super
                Video Ads and other special tools.
              </p>
              {/* The blade writes `mailto:martinherrada` — no domain, so it was not an
                  address at all and the button did nothing, in Laravel as much as here.
                  Repairing the address was not enough: a mailto opens nothing on a machine
                  with no mail client, and where it does open it only drafts a message the
                  advertiser still has to send. The request is sent from the server now, so
                  it reaches the admin whatever the advertiser is browsing on, and they are
                  told it went. */}
              {vipSent ? (
                <p style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
                  ✅ Request sent — we will be in touch by email.
                </p>
              ) : (
                <>
                  {/* the app's own business button, per the client's note — see
                      .superads-verify-btn in ads-center.css */}
                  <button
                    type="button"
                    className="superads-verify-btn"
                    disabled={vipBusy}
                    onClick={() => void requestVip()}
                  >
                    {vipBusy ? 'Sending…' : 'VERIFICATE'}
                  </button>
                  {vipError && (
                    <p style={{ fontSize: 14, marginTop: 12, marginBottom: 0, color: '#ffd7d7' }}>{vipError}</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {card && (
        <CreateAdModal
          card={card}
          onClose={() => setCard(null)}
          /* the post the Boost modal was opened for, if the route carried one */
          initialPostId={boostPostId}
          actingForHandle={data?.actingFor?.usernameUrl ?? null}
          /* so the live preview draws the button this advertiser's ad will actually carry */
          advertiserPaid={isPaidAdvertiser({
            role: data?.role,
            priceOfSubscription: data?.priceOfSubscription,
          })}
        />
      )}
    </>
  );
}

/* ================= profile-gate modal ================= */
function ProfileModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: Record<string, unknown> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  /* the advertiser profile being filled in belongs to the account being worked in */
  const [params] = useSearchParams();
  const as = params.get('as');
  const [f, setF] = useState({
    name: (initial?.name as string) ?? '',
    surnames: (initial?.surnames as string) ?? '',
    country: (initial?.country as string) ?? '',
    city: (initial?.city as string) ?? '',
    address: (initial?.address as string) ?? '',
    zip_code: (initial?.zipCode as string) ?? '',
    mobile_number: (initial?.mobileNumber as string) ?? '',
    fiscal_taxes_eeuu: !!initial?.fiscalTaxesEeuu,
    is_marketing_agency: !!initial?.isMarketingAgency,
    is_talent_agency: !!initial?.isTalentAgency,
    is_freelancer: !!initial?.isFreelancer,
    is_company: !!initial?.isCompany,
    company_size: (initial?.companySize as string) ?? '',
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/ads/profile', { ...f, ...(as ? { onBehalfOf: as } : {}) });
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ads-modal-overlay" onClick={onClose}>
      <div className="ads-modal-box" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ background: '#8a2be2', color: 'white', borderRadius: 12, padding: 25, overflowY: 'auto' }}>
          <button className="close-modal-btn" onClick={onClose}>✖</button>
          <h4 className="text-center mb-3">Completa tu Información</h4>
          <form onSubmit={submit}>
            <div className="row">
              <div className="form-group col-md-6"><label>Name</label><input className="form-control" value={f.name} onChange={(e) => set('name', e.target.value)} required /></div>
              <div className="form-group col-md-6"><label>Surnames</label><input className="form-control" value={f.surnames} onChange={(e) => set('surnames', e.target.value)} required /></div>
              <div className="form-group col-md-6"><label>Country</label>
                <CountrySelect
                  className="form-control"
                  value={f.country}
                  required
                  onChange={(c) => setF((x) => ({ ...x, country: c, city: '' }))}
                />
              </div>
              <div className="form-group col-md-6"><label>City</label>
                <CitySelect
                  className="form-control"
                  country={f.country}
                  value={f.city}
                  onChange={(c) => set('city', c)}
                />
              </div>
              <div className="form-group col-md-6"><label>Address</label><input className="form-control" value={f.address} onChange={(e) => set('address', e.target.value)} required /></div>
              <div className="form-group col-md-6"><label>ZIP Code</label><input className="form-control" value={f.zip_code} onChange={(e) => set('zip_code', e.target.value)} required /></div>
              <div className="form-group col-md-12"><label>Mobile Number</label><PhoneField id="adPhoneField" className="form-control" value={f.mobile_number} onChange={(v) => set('mobile_number', v)} required /></div>
            </div>

            <div className="form-check mb-2">
              <input type="checkbox" className="form-check-input" id="fiscalTaxesCheck" checked={f.fiscal_taxes_eeuu} onChange={(e) => set('fiscal_taxes_eeuu', e.target.checked)} />
              <label className="form-check-label" htmlFor="fiscalTaxesCheck">I have fiscal taxes in the USA</label>
            </div>
            <div className="mb-2"><b>Account type:</b></div>
            {[
              ['is_marketing_agency', 'Marketing Agency'],
              ['is_talent_agency', 'Talent Agency'],
              ['is_freelancer', 'Freelancer'],
              ['is_company', 'Company'],
            ].map(([k, label]) => (
              <div className="form-check" key={k}>
                <input type="checkbox" className="form-check-input" id={k} checked={f[k as keyof typeof f] as boolean} onChange={(e) => set(k as keyof typeof f, e.target.checked)} />
                <label className="form-check-label" htmlFor={k}>{label}</label>
              </div>
            ))}
            {f.is_company && (
              <div style={{ marginLeft: 20, marginTop: 10, padding: 10, background: 'rgba(255,255,255,0.1)', borderRadius: 8 }}>
                {['small', 'big', 'super'].map((s) => (
                  <div className="form-check" key={s}>
                    <input type="radio" name="company_size" className="form-check-input" id={`cs-${s}`} checked={f.company_size === s} onChange={() => set('company_size', s)} />
                    <label className="form-check-label" htmlFor={`cs-${s}`}>{s === 'small' ? '1-10 employees' : s === 'big' ? '11-50 employees' : '50+ employees'}</label>
                  </div>
                ))}
              </div>
            )}
            <button type="submit" className="continue-btn mt-3" disabled={busy}>Save</button>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ================= create-ad modal ================= */
function CreateAdModal({
  card,
  onClose,
  advertiserPaid = false,
  initialPostId,
  actingForHandle = null,
}: {
  card: AdCard;
  onClose: () => void;
  advertiserPaid?: boolean;
  /** the linked account's @nickname, when a business is working inside one */
  actingForHandle?: string | null;
  /** preselected post, when the centre was opened from Boost Your Post */
  initialPostId?: string;
}) {
  /* the account this ad is being made for, when a business is working inside a linked one */
  const [params] = useSearchParams();
  const as = params.get('as');
  const [amount, setAmount] = useState(card.min);
  const [days, setDays] = useState(4);
  const [terms, setTerms] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [media, setMedia] = useState<string>(''); // base64
  const [postId, setPostId] = useState(initialPostId ?? '');
  /* what the picked post looks like, so the preview can show it — the three post-picker
     cards never upload anything, so without this their preview stayed empty */
  const [postMedia, setPostMedia] = useState<string | null>(null);
  const [questions, setQuestions] = useState<string[]>(['']);
  const [asks, setAsks] = useState({ ask_phone: true, ask_email: true, ask_name: false, ask_company: false });
  const [buttonAction, setButtonAction] = useState(BUTTON_ACTIONS[0]);
  /* how the call to action is drawn on the creative — the advertiser's own choice */
  const [buttonSize, setButtonSize] = useState<AdButtonSize>('medium');
  const [buttonPosition, setButtonPosition] = useState<AdButtonPosition>('bottom');
  /* the advertiser's logo and handle beside "Super Ads" on WORLD and the walls — off by
     default, so an advertiser has to ask for their name on the tile rather than find it there */
  const [showAdvertiserTag, setShowAdvertiserTag] = useState(false);
  /* which button design, on the types that offer more than one (Spotify & iTunes, Amazon) */
  const variants = AD_BUTTON_VARIANTS[card.type];
  const [buttonVariant, setButtonVariant] = useState<string | null>(null);
  /* promote-post: "Post as:" — an ad with the tags, or an ordinary post (+11%) */
  const isPromotePost = card.type === 'promote-post';
  const [promoteAs, setPromoteAs] = useState<'ad' | 'post' | null>(null);
  /* the @nickname the promoted post will carry — the linked account's, when working in one */
  const { user: authUser } = useAuth();
  const advertiserHandle = actingForHandle ?? authUser?.usernameUrl ?? null;
  const [busy, setBusy] = useState(false);
  /* what went wrong, in the modal. Without this the submit failed in silence: the button
     stopped spinning and nothing else happened, so a rejected video looked like a dead form. */
  const [error, setError] = useState<string | null>(null);

  // Ref for the Website URL input – used to scroll into view
  const websiteUrlRef = useRef<HTMLInputElement>(null);

  /* Whatever the ad will actually carry: an upload if there is one, otherwise the post the
     advertiser picked. A data URL says its own type; a picked post is named by its file. */
  const previewSrc = media || (postMedia ? assetImage(postMedia) : '');
  const previewIsVideo = media
    ? /^data:video\//i.test(media)
    : !!postMedia && isVideoFile(postMedia);

  const estimated = Math.round((amount / 1000) * card.audience);
  const perDay = days > 0 ? Math.round(estimated / days) : 0;
  const setField = (k: string, v: string) => setFields((s) => ({ ...s, [k]: v }));

  // Scroll to Website URL field when it becomes visible (buttonAction === 'Check Website')
  useEffect(() => {
    if (buttonAction === 'Check Website' && websiteUrlRef.current) {
      setTimeout(() => {
        websiteUrlRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 100);
    }
  }, [buttonAction]);

  /* The creative travels inside the JSON body as base64, which adds about a third to it,
     and the server refuses a body over 20MB. Catching it here means the advertiser is told
     at once rather than after filling the rest of the form in. */
  const MAX_MEDIA_MB = 14;

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (file.size > MAX_MEDIA_MB * 1024 * 1024) {
      setMedia('');
      e.target.value = '';
      setError(
        `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The most an ad can carry is ` +
          `${MAX_MEDIA_MB} MB — please compress the video or use a shorter clip.`,
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setMedia(String(reader.result));
    reader.onerror = () => setError('That file could not be read. Please try another one.');
    reader.readAsDataURL(file);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!terms) return;
    if (variants && !buttonVariant) {
      setError('Choose the button for your ad.');
      return;
    }
    if (isPromotePost && !promoteAs) {
      setError('Choose how to post it: as an Ad with Tags marks, or as a normal Post.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        ad_name: fields.ad_name,
        amount,
        campaign_days: days,
        payment_type: 'one_time',
        country,
        city,
        ...fields,
      };

      // Only send link if "Check Website" is selected and a URL is entered
      if (buttonAction === 'Check Website' && fields.website_url) {
        body.link = fields.website_url;
      }

      if (media) body.media = media;
      if (postId) body.post_id = postId;
      /* `outside` is drawn small whatever the select last held, so the locked value is what
         is sent rather than whatever the advertiser had picked before switching */
      body.button_size = buttonPosition === 'outside' ? OUTSIDE_LOCKED_SIZE : buttonSize;
      body.button_position = buttonPosition;
      if (buttonVariant) body.button_variant = buttonVariant;
      if (isPromotePost && promoteAs) body.promote_as = promoteAs;
      body.show_advertiser_tag = showAdvertiserTag;

      if (card.type === 'clients-form') {
        body.question1 = questions[0] ?? '';
        body.question2 = questions[1] ?? '';
        body.question3 = questions[2] ?? '';
        body.question4 = questions[3] ?? '';
        body.ask_phone = asks.ask_phone ? 1 : 0;
        body.ask_email = asks.ask_email ? 1 : 0;
        body.ask_name = asks.ask_name ? 1 : 0;
        body.ask_company = asks.ask_company ? 1 : 0;
        body.button_action = buttonAction;
      }

      const { data } = await api.post<{ url?: string }>(`/ads/initiate-payment/${card.type}`, {
        ...body,
        ...(as ? { onBehalfOf: as } : {}),
      });
      if (data.url) window.location.href = data.url;
      else setError('The payment page could not be opened. Please try again.');
    } catch (err) {
      const res = (err as { response?: { status?: number; data?: { message?: string } } }).response;
      setError(
        res?.status === 413
          ? `That file is too large to upload. The most an ad can carry is ${MAX_MEDIA_MB} MB.`
          : res?.data?.message ?? 'Something went wrong. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  const usesPostPicker = [1, 2, 3].includes(card.id);
  const lockedPrefix: Record<number, [string, string]> = {
    4: ['instagram_url', 'https://instagram.com/'],
    5: ['tiktok_username', 'https://tiktok.com/@'],
    6: ['twitch_username', 'https://twitch.tv/'],
    7: ['youtube_username', 'https://youtube.com/'],
  };
  const plainInput: Record<number, [string, string]> = {
    8: ['amazon_url', 'Amazon URL (https://...)'],
    15: ['aliexpress_temu_url', 'AliExpress or Temu URL (https://...)'],
    16: ['ecommerce_url', 'E-commerce URL (https://...)'],
    9: ['spotify_url', 'Spotify or iTunes URL (https://...)'],
    10: ['website_url', 'Website URL (https://...)'],
  };
  const isPhone = card.id === 11 || card.id === 12;
  const isFormulary = card.id === 13;

  return (
    <div className="ads-modal-overlay" onClick={onClose}>
      <div className="ads-modal-box" onClick={(e) => e.stopPropagation()}>
        <div style={{ background: '#111', border: '7px solid #111', color: '#fff', borderRadius: 18, padding: '32px 28px', textAlign: 'center' }}>
          <button className="close-modal-btn" onClick={onClose}>✖</button>
          {/* the Spotify & iTunes modal carries both logos in place of the megaphone, and
              keeps the shorter title David wrote on it */}
          {/* David, 6 Oct 2026: each modal leads with its own card's marks, not the 📢 they
              all shared. The modal is black, so a logo with a light version (the card's
              hover one) takes that. Spotify keeps the logos and shorter title of his own
              mockup. The space under the title is the <br> he asked for after it. */}
          {!isFormulary && (
            <h2 className="ads-modal-brand-title">
              <span className="ads-modal-title-icons">
                {(MODAL_ICONS[card.type] ?? card.icons).map((icon) => {
                  if (!icon.startsWith('/')) return <span key={icon}>{icon}</span>;
                  const [normal, light] = icon.split('|');
                  return <img key={icon} src={light ?? normal} alt="" />;
                })}
              </span>
              {MODAL_TITLE[card.type] ?? card.title}
            </h2>
          )}

          <form onSubmit={submit}>
            {/* type-specific fields */}
            {!usesPostPicker && !isFormulary && (
              <input className="form-control my-3 w-75 mx-auto" placeholder="Choose name for your Ad" value={fields.ad_name ?? ''} onChange={(e) => setField('ad_name', e.target.value)} required />
            )}

            {usesPostPicker && (
              <>
                <input className="form-control my-3 w-75 mx-auto" placeholder="Choose name for your Ad" value={fields.ad_name ?? ''} onChange={(e) => setField('ad_name', e.target.value)} required />
                <h5 className="mt-3 mb-2">Select a Post{card.id !== 1 ? ' Or upload media' : ''}</h5>
                <PostPicker
                  value={postId}
                  onSelect={(id, m) => {
                    setPostId(id);
                    setPostMedia(m);
                  }}
                />
              </>
            )}

            {lockedPrefix[card.id] && (
              <div className="input-group my-3 w-75 mx-auto">
                <span className="input-group-text" style={{ background: '#f0f0f0', fontWeight: 600 }}>{lockedPrefix[card.id][1]}</span>
                <input className="form-control" placeholder="username" value={fields[lockedPrefix[card.id][0]] ?? ''} onChange={(e) => setField(lockedPrefix[card.id][0], e.target.value)} required />
              </div>
            )}

            {/* one box per button design; ticking one unticks the others. Spotify's are
                named, Amazon's three are shown as the buttons themselves. Same price. */}
            {variants && (
              <div className="ads-variant-row w-75 mx-auto">
                {variants.map((v) => (
                  <label key={v} className="ads-variant-check">
                    <input
                      type="checkbox"
                      checked={buttonVariant === v}
                      onChange={(e) => {
                        setButtonVariant(e.target.checked ? v : null);
                        setError(null);
                      }}
                    />
                    {VARIANT_NAME[v] ? (
                      <span className="ads-variant-name">{VARIANT_NAME[v]}</span>
                    ) : (
                      <span className={`ad-cta-btn cta-${v} pos-outside`}>
                        <CtaMark action={v} />
                        <span>{AD_ACTION_LABEL[v]}</span>
                      </span>
                    )}
                  </label>
                ))}
              </div>
            )}

            {plainInput[card.id] && (
              <input className="form-control my-3 w-75 mx-auto" placeholder={plainInput[card.id][1]} value={fields[plainInput[card.id][0]] ?? ''} onChange={(e) => setField(plainInput[card.id][0], e.target.value)} />
            )}

            {isPhone && (
              <div className="my-3 w-75 mx-auto">
                <PhoneField
                  id="phoneField"
                  className="form-control"
                  placeholder={card.id === 12 ? 'WhatsApp Number' : 'Phone Number'}
                  value={fields.phone ?? ''}
                  onChange={(v) => setField('phone', v)}
                  required
                />
              </div>
            )}

            {isFormulary && (
              <>
                <h3 className="ads-section-title mt-2 mb-3">📄 FORMULARY POTENTIAL CLIENTS</h3>
                <input className="form-control ads-input mb-3 w-75 mx-auto" placeholder="Choose a name for your Ad" value={fields.ad_name ?? ''} onChange={(e) => setField('ad_name', e.target.value)} required />

                {/* Website URL field – only shown when "Check Website" is selected */}
                {buttonAction === 'Check Website' && (
                  <input
                    ref={websiteUrlRef}
                    className="form-control ads-input mb-3 w-75 mx-auto"
                    placeholder="Website URL (e.g., https://example.com)"
                    value={fields.website_url ?? ''}
                    onChange={(e) => setField('website_url', e.target.value)}
                    required
                  />
                )}

                {questions.map((q, i) => (
                  <div className="extra-question-box" key={i}>
                    <input className="form-control" maxLength={400} placeholder={`Choose a question ${i + 1}. (Max. 400 chars)`} value={q} onChange={(e) => setQuestions((s) => s.map((x, j) => (j === i ? e.target.value : x)))} required={i === 0} />
                    {i > 0 && <button type="button" className="remove-question-btn" onClick={() => setQuestions((s) => s.filter((_, j) => j !== i))}>✕</button>}
                  </div>
                ))}
                {questions.length < 4 && (
                  <button type="button" className="add-question-btn w-75 mb-3" onClick={() => setQuestions((s) => [...s, ''])}>➕ Add question (Max 4)</button>
                )}
                <div className="d-flex flex-wrap mb-3 w-75 mx-auto ads-checkbox-group">
                  <label><input type="checkbox" checked={asks.ask_phone} onChange={(e) => setAsks((s) => ({ ...s, ask_phone: e.target.checked }))} /> Ask Phone Number</label>
                  <label><input type="checkbox" checked={asks.ask_email} onChange={(e) => setAsks((s) => ({ ...s, ask_email: e.target.checked }))} /> Ask Email</label>
                  <label><input type="checkbox" checked={asks.ask_name} onChange={(e) => setAsks((s) => ({ ...s, ask_name: e.target.checked }))} /> Ask Name</label>
                  <label><input type="checkbox" checked={asks.ask_company} onChange={(e) => setAsks((s) => ({ ...s, ask_company: e.target.checked }))} /> Ask Company name</label>
                </div>
                <label className="mt-2">Select button action:</label>
                <select className="ads-input mb-3" value={buttonAction} onChange={(e) => setButtonAction(e.target.value)}>
                  {BUTTON_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </>
            )}

            {/* How the call to action is drawn. It is asked here rather than decided for the
                advertiser because the right size and place depend on the artwork — a face in
                the lower third wants the button at the top, and the other way round.
                A promoted post has no button any more (David, 5 Oct 2026), so it is asked
                how the post is to be shown instead. */}
            <div className="ads-cta-choice">
              {!isPromotePost && (
              <>
              <h5 className="mb-2">Button on your ad</h5>
              <div className="ads-cta-row">
                {/* David, 4 Oct 2026: "If we select outside, size gets blocked: small."
                    Out from under the creative there is no card to measure the button
                    against, so the three sizes have nothing to mean — the choice is made
                    for the advertiser and the control says so rather than going quiet. */}
                <label>
                  Size
                  <select
                    className="ads-input"
                    value={buttonPosition === 'outside' ? OUTSIDE_LOCKED_SIZE : buttonSize}
                    disabled={buttonPosition === 'outside'}
                    onChange={(e) => setButtonSize(e.target.value as AdButtonSize)}
                  >
                    {AD_BUTTON_SIZES.map((s2) => (
                      <option key={s2} value={s2}>
                        {s2[0].toUpperCase() + s2.slice(1)}
                      </option>
                    ))}
                  </select>
                  {buttonPosition === 'outside' && (
                    <small className="ads-cta-locked-note">Outside is always small</small>
                  )}
                </label>
                <label>
                  Position
                  <select
                    className="ads-input"
                    value={buttonPosition}
                    onChange={(e) => {
                      const next = e.target.value as AdButtonPosition;
                      setButtonPosition(next);
                      /* the locked value is what gets submitted, not just what is shown */
                      if (next === 'outside') setButtonSize(OUTSIDE_LOCKED_SIZE);
                    }}
                  >
                    {AD_BUTTON_POSITIONS.map((p2) => (
                      <option key={p2} value={p2}>
                        {p2[0].toUpperCase() + p2.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* David, 4 Oct 2026: the advertiser decides whether their own logo and handle
                  stand beside "Super Ads". It changes the tile on WORLD and the walls only —
                  the full-screen viewer names them in its bottom bar either way, which is
                  what the second half of the label says. */}
              <label className="ads-advertiser-tag-check">
                <input
                  type="checkbox"
                  checked={showAdvertiserTag}
                  onChange={(e) => setShowAdvertiserTag(e.target.checked)}
                />{' '}
                {/* plain English, like every other label on this form — the Ads Center has
                    no i18n namespace of its own and is written in English throughout */}
                Show my logo and username on tag post in WORLD and WALLS
                <small> (this doesn&apos;t affect the full screen viewer)</small>
              </label>
              </>
              )}

              {/* the choice, shown on the advertiser's own artwork where there is any */}
              {isPromotePost ? (
                <PromotePostPreview
                  src={previewSrc}
                  isVideo={previewIsVideo}
                  promoteAs={promoteAs}
                  handle={advertiserHandle}
                />
              ) : (
                <AdButtonPreview
                  src={previewSrc}
                  isVideo={previewIsVideo}
                  adType={card.type}
                  size={buttonPosition === 'outside' ? OUTSIDE_LOCKED_SIZE : buttonSize}
                  position={buttonPosition}
                  buttonAction={card.type === 'clients-form' ? buttonAction : null}
                  advertiserPaid={advertiserPaid}
                  buttonVariant={buttonVariant}
                />
              )}

              {/* "Post as:" — (a) an ad, in the ad slots, with the Super Ads and @nickname tags;
                  (b) an ordinary post in WORLD, no tag at all, at 11% more. Either way the bot
                  adds the 👥 estimate below to the post's views over the campaign's days. */}
              {isPromotePost && (
                <div className="ads-post-as">
                  <h5>Post as:</h5>
                  <div className="ads-variant-row">
                    <label className="ads-variant-check">
                      <input
                        type="checkbox"
                        checked={promoteAs === 'ad'}
                        onChange={(e) => {
                          setPromoteAs(e.target.checked ? 'ad' : null);
                          setError(null);
                        }}
                      />
                      <span className="ads-post-as-name">As an Ad with Tags marks</span>
                    </label>
                    <label className="ads-variant-check">
                      <input
                        type="checkbox"
                        checked={promoteAs === 'post'}
                        onChange={(e) => {
                          setPromoteAs(e.target.checked ? 'post' : null);
                          setError(null);
                        }}
                      />
                      <span className="ads-post-as-name">
                        As a normal Post <small>(+11% Expensive)</small>
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* location (all types) */}
            <LocationPicker onChange={(c, ci) => { setCountry(c); setCity(ci); }} />

            {/* media upload (all except pure post picker id 1) */}
            {card.id !== 1 && (
              <div className="my-3 w-75 mx-auto">
                <label style={{ fontSize: 16, fontWeight: 600 }}>Upload Image/Video</label>
                <input type="file" accept="image/*,video/mp4,video/webm" className="form-control" onChange={onFile} />
                <small className="text-white d-block mt-1">• Images: JPG, PNG • Videos: MP4, WEBM (max 2 minutes)</small>
              </div>
            )}

            {/* amount slider */}
            <div className="field mt-3">
              <label style={{ fontSize: 16 }}>Amount</label>
              <input type="range" min={card.min} max={card.max} step={1} value={amount} style={{ ['--value' as string]: `${((amount - card.min) / (card.max - card.min)) * 100}%` }} onChange={(e) => setAmount(Number(e.target.value))} />
              <div className="value">
                ${amount}
                {/* the surcharge, shown before paying — the server charges the same figure */}
                {isPromotePost && promoteAs === 'post' && (
                  <small className="ads-surcharge"> +11% = ${(Math.round(amount * 111) / 100).toFixed(2)}</small>
                )}
              </div>
              <div className="value">👥 {estimated.toLocaleString()}</div>
            </div>

            {/* days slider */}
            <div className="field mt-3">
              <label style={{ fontSize: 16 }}>Duration<br />Days</label>
              <input type="range" min={4} max={45} step={1} value={days} style={{ ['--value' as string]: `${((days - 4) / (45 - 4)) * 100}%` }} onChange={(e) => setDays(Number(e.target.value))} />
              <div className="value">{days} days</div>
              <div className="value">{perDay > 0 ? `~${perDay.toLocaleString()} 👥/day` : ''}</div>
            </div>

            <label style={{ fontSize: 16, display: 'block', marginTop: 20 }}>
              <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} required /> I agree to Terms &amp; Conditions
            </label>

            {/* whatever the server or the file check objected to, said where it will be read */}
            {error && (
              <p className="ads-form-error" role="alert">
                {error}
              </p>
            )}

            <button className="continue-btn mt-4" disabled={busy}>Empezar campaña 📊</button>
            <button type="button" className="cancel-btn mt-2" onClick={onClose}>CANCEL</button>
          </form>
        </div>
      </div>
    </div>
  );
}