import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdLeadForm } from '../pages/ads/AdLeadForm';
import { PremiumFanModal } from './PremiumFanModal';
import { api } from '../api/client';
import { SubscribeModal } from '../pages/profile/SubscribeModal';
import { assetImage, isVideoFile, videoMime } from '../utils/format';

/**
 * One Super Ads tile, as it appears on the World feed and the walls.
 *
 * It lived inside World.tsx until the client asked for a page that shows every ad in the
 * system; both draw the same tile, so it moved here rather than being copied. The World
 * feed's own card markup around it is unchanged.
 *
 * Beneath the creative sits the advertiser's call to action. The button the client drew is
 * new — it is in neither the Laravel original nor the earlier MERN — so what each one does
 * is set out in ACTIONS below rather than guessed at the call site.
 */

export interface AdCardItem {
  id: string;
  media?: string;
  link?: string;
  adId?: string;
  adType?: string | null;
  /** the advertiser: the profile Follow/Subscribe lead to, and who a Send Card writes to */
  advertiser?: {
    id?: string;
    usernameUrl: string | null;
    name?: string | null;
    profilePicture?: string | null;
    /** false when they have set themselves Busy — a card then costs the $10 first */
    chatToggle?: boolean;
    /** this viewer has already bought priority access to them */
    viewerPremium?: boolean;
    /** a creator with a price is subscribed to, not followed */
    role?: string | null;
    priceOfSubscription?: number | null;
    /** what this viewer already is to them */
    viewerFollowing?: boolean;
    viewerSubscribed?: boolean;
  } | null;
  /** the post a picker ad promotes, opened full screen when the creative is clicked */
  postId?: string | null;
  /** clients-form ads carry the advertiser's own choice of wording */
  buttonAction?: string | null;
  /** how big the advertiser asked for the button, and where on the creative */
  buttonSize?: AdButtonSize | null;
  buttonPosition?: AdButtonPosition | null;
}

/** The advertiser picks both of these on the create form. */
export type AdButtonSize = 'small' | 'medium' | 'large';
export type AdButtonPosition = 'top' | 'center' | 'bottom';

export const AD_BUTTON_SIZES: AdButtonSize[] = ['small', 'medium', 'large'];
export const AD_BUTTON_POSITIONS: AdButtonPosition[] = ['top', 'center', 'bottom'];

/** The client's six calls to action. */
export type AdAction = 'more-details' | 'call' | 'send-card' | 'subscribe' | 'follow' | 'whatsapp';

export const AD_ACTION_LABEL: Record<AdAction, string> = {
  'more-details': 'More details',
  call: 'Call',
  'send-card': 'Send Card',
  subscribe: 'Subscribe',
  follow: 'Follow',
  whatsapp: 'Whatsapp',
};

/**
 * Which call to action a tile carries, taken from what the ad was bought as. An advertiser
 * does not choose this on most types — the type already says what the ad is for — so the
 * mapping lives here and the tile stays honest about where its button leads.
 */
export function adAction(adType: string | null | undefined): AdAction {
  switch (adType) {
    case 'calls':
      return 'call';
    case 'whatsapp':
      return 'whatsapp';
    case 'messages':
      return 'send-card';
    case 'profile-followers':
      /* Follow on a free account, Subscribe on a creator who charges — the caller settles
         which, since it depends on the advertiser and not on the type. */
      return 'follow';
    default:
      /* youtube, website-visits, instagram, tiktok, twitch, amazon, spotify,
         promote-post and anything migrated without a type all lead outward. YouTube was
         Subscribe for a while; the client moved it back here. */
      return 'more-details';
  }
}

/** A `mailto:` is never followed from a tile: it does nothing on most machines, and it is
    the advertiser's own address. Anything else the Ads Center writes is left alone. */
function safeLink(link: string | undefined): string | null {
  if (!link) return null;
  return /^mailto:/i.test(link.trim()) ? null : link;
}

export function AdCard({ item, showType = false }: { item: AdCardItem; showType?: boolean }) {
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState(false);
  /* the $10 that stands in front of writing when the advertiser is Busy */
  const [premiumOpen, setPremiumOpen] = useState(false);
  const media = item.media ?? '';
  const handle = item.advertiser?.usernameUrl ?? null;

  /* A `profile-followers` ad asks the viewer for a relationship with the advertiser, and
     which relationship depends on the advertiser: a creator who charges is subscribed to,
     everyone else is followed. Same test the profile and the full-screen viewer make. */
  const advertiserPaid =
    item.advertiser?.role === 'influencer' && (item.advertiser?.priceOfSubscription ?? 0) > 0;
  const baseAction = adAction(item.adType);
  const action: AdAction =
    baseAction === 'follow' && advertiserPaid ? 'subscribe' : baseAction;

  /* already following / subscribed — the button has nothing left to ask for */
  const [done, setDone] = useState(
    action === 'subscribe'
      ? !!item.advertiser?.viewerSubscribed
      : !!item.advertiser?.viewerFollowing,
  );
  const [subOpen, setSubOpen] = useState(false);
  const [subBusy, setSubBusy] = useState(false);
  const advertiserId = item.advertiser?.id ?? null;

  /* "they start to follow the user directly, still navigating in WORLD page" — no
     navigation, no dialog; the button reports it and the viewer carries on scrolling. */
  function follow() {
    if (!advertiserId || done) return;
    setDone(true);
    void api.post(`/me/follow/${advertiserId}`).catch(() => setDone(false));
  }

  /* the profile's own checkout, behind the profile's own dialog */
  function subscribe() {
    if (!advertiserId || subBusy) return;
    setSubBusy(true);
    api
      .post<{ url?: string }>(`/payments/subscribe/${advertiserId}`)
      .then(({ data }) => {
        if (data.url) window.location.href = data.url;
        else setSubBusy(false);
      })
      .catch(() => setSubBusy(false));
  }

  /* Clicking the creative opens the promoted post full screen, and takes the same step the
     button would: a free advertiser is followed on the way, a paid one raises the payment
     dialog over the post — which can be closed to read it, the Subscribe button then
     sitting beside the nickname. */
  function openPost() {
    if (!item.postId) return false;
    if (action === 'follow') follow();
    navigate(`/user/post_detail/${item.postId}`, {
      state: action === 'subscribe' ? { subscribe: true } : undefined,
    });
    return true;
  }

  /* A clients-form ad is its own tile: the creative with the advertiser's button under it,
     walking the viewer through the formulary in place rather than leading anywhere.
     We now render the tile like any other ad, with the button respecting size/position,
     and open the form in a modal when clicked. */
  if (item.adType === 'clients-form' && item.adId) {
    const label = item.buttonAction || AD_ACTION_LABEL[action];

    return (
      <>
        <div className="col-md-4 col-sm-6 col-xs-6 col-xxs-12 work-item">
          <p className="feed_posts_heading_p ad-card-heading" style={{ position: 'relative', fontSize: 14 }}>
            <span>Super Ads</span>
            {showType && <TypeTag adType={item.adType} />}
          </p>

          <div className="ad-media">
            {isVideoFile(media) ? (
              <video
                className="autoplay-video"
                controlsList="nodownload"
                style={{ maxWidth: '100%' }}
                controls
                loop
                muted
                playsInline
              >
                <source src={assetImage(media)} type={videoMime(media)} />
              </video>
            ) : (
              <img
                src={assetImage(media)}
                alt="Advertisement"
                className="img-responsive posttt-img"
                style={{ borderRadius: 26, border: '7px solid lightgray', width: '100%' }}
              />
            )}

            <AdCta
              action={action}
              label={label}
              href={null}
              onClick={() => setFormOpen(true)}
              size={item.buttonSize ?? 'medium'}
              position={item.buttonPosition ?? 'bottom'}
              isForm={true}
            />
          </div>
        </div>
      {formOpen && (
        <AdLeadForm
          adId={item.adId}
          media={media}
          link={item.link}
          onClose={() => setFormOpen(false)}
        />
      )}
      </>
    );
  }

  /* Where the button goes. The ad's own link already carries it for every outward type —
     the Ads Center writes `tel:` for a calls ad and a wa.me address for a WhatsApp one
     (ads.routes buildAd), so there is nothing to assemble here.
     Three of them lead back into the app instead and are navigated rather than followed:
     Follow, Subscribe, and Send Card. Send Card used to be a `mailto:` to the advertiser,
     which did nothing at all in a browser with no mail client set, and put their address
     in the page for anyone to scrape. */
  /* Send Card is the client's own answer for this one: "We open Modal for send direct
     message to the user/influencer." So it opens that dialog here rather than leading
     anywhere. Follow and Subscribe still go to the advertiser's profile. */
  let href: string | null = null;
  let onClick: (() => void) | null = null;

  /* A card writes to the advertiser's inbox, so it answers to the same rule the profile's
     ✉️ does: Busy means the $10 first, and someone who has already paid writes anyway. */
  const advertiserBusy =
    item.advertiser?.chatToggle === false && !item.advertiser?.viewerPremium;

  if (action === 'send-card' && advertiserId && handle)
    onClick = () =>
      advertiserBusy ? setPremiumOpen(true) : navigate(`/user/messages?to=${handle}`);
  else if (action === 'follow' && advertiserId) onClick = follow;
  else if (action === 'subscribe' && advertiserId) onClick = () => setSubOpen(true);
  else href = safeLink(item.link);

  return (
    <div className="col-md-4 col-sm-6 col-xs-6 col-xxs-12 work-item">
      <p className="feed_posts_heading_p ad-card-heading" style={{ position: 'relative', fontSize: 14 }}>
        <span>Super Ads</span>
        {showType && <TypeTag adType={item.adType} />}
      </p>

      <div className="ad-media">
        <a
          className="ad-media-link"
          href={item.postId ? `/user/post_detail/${item.postId}` : safeLink(item.link) ?? '#'}
          target={item.postId ? undefined : '_blank'}
          rel="noreferrer"
          onClick={(e) => {
            if (openPost()) e.preventDefault();
          }}
        >
          {isVideoFile(media) ? (
            <video
              className="autoplay-video"
              controlsList="nodownload"
              style={{ maxWidth: '100%' }}
              controls
              loop
              muted
              playsInline
            >
              <source src={assetImage(media)} type={videoMime(media)} />
            </video>
          ) : (
            <img
              src={assetImage(media)}
              alt="Advertisement"
              className="img-responsive posttt-img"
              style={{ borderRadius: 26, border: '7px solid lightgray', width: '100%' }}
            />
          )}
        </a>

        <AdCta
          action={action}
          label={
            item.buttonAction ||
            (done
              ? action === 'subscribe'
                ? 'Subscribed'
                : 'Following'
              : AD_ACTION_LABEL[action])
          }
          href={href}
          onClick={onClick}
          size={item.buttonSize ?? 'medium'}
          position={item.buttonPosition ?? 'bottom'}
        />
      </div>

      {handle && (
        <SubscribeModal
          usernameUrl={handle}
          open={subOpen}
          busy={subBusy}
          onClose={() => setSubOpen(false)}
          onConfirm={subscribe}
        />
      )}

      {premiumOpen && advertiserId && (
        <PremiumFanModal
          influencerId={advertiserId}
          usernameUrl={item.advertiser?.usernameUrl ?? null}
          profilePicture={item.advertiser?.profilePicture ?? null}
          onClose={() => setPremiumOpen(false)}
        />
      )}
    </div>
  );
}

/** The mark the client draws beside each label, taken from the cards in /ads-images:
    a red flag on Subscribe and Follow, a green disc on Whatsapp, and an emoji on the
    other three. The flag and the disc are drawn rather than borrowed from an emoji font,
    which renders them differently on every machine. */
export function CtaMark({ action }: { action: AdAction }) {
  if (action === 'subscribe' || action === 'follow') {
    return (
      <span className="cta-mark" aria-hidden="true">
        <svg width="24" height="28" viewBox="0 0 24 28">
          <rect x="0" y="0" width="5" height="28" fill="#e09e88" />
          <path d="M4 2 L24 10 L4 18 Z" fill="#f7302c" />
        </svg>
      </span>
    );
  }
  if (action === 'whatsapp') {
    return (
      <span className="cta-mark" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 18 18">
          <circle cx="9" cy="9" r="8" fill="#12c40a" />
        </svg>
      </span>
    );
  }
  const glyph = action === 'call' ? '\u{1F4DE}' : action === 'send-card' ? '✉️' : '\u{1F4DD}';
  return (
    <span className="cta-mark" aria-hidden="true">
      {glyph}
    </span>
  );
}

function AdCta({
  action,
  label,
  href,
  onClick,
  size = 'medium',
  position = 'bottom',
  isForm = false,
}: {
  action: AdAction;
  label: string;
  href: string | null;
  onClick: (() => void) | null;
  size?: AdButtonSize;
  position?: AdButtonPosition;
  isForm?: boolean;
}) {
  let className = `ad-cta-btn cta-${action} size-${size} pos-${position}`;
  if (isForm) className += ' form-cta';

  /* The mark leads on every one of them. The client's cards put it on the right for four
     of the six and on the left for the other two; he asked for one side throughout, and
     chose the left — so a row of tiles reads down a single column of marks. */
// Icon on the right for Follow and Subscribe; on the left for all others.
const markFirst = !(action === 'follow' || action === 'subscribe');
const inner = markFirst ? (
  <>
    <CtaMark action={action} />
    <span>{label}</span>
  </>
) : (
  <>
    <span>{label}</span>
    <CtaMark action={action} />
  </>
);
  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClick();
        }}
      >
        {inner}
      </button>
    );
  }
  return (
    <a
      className={className}
      href={href ?? '#'}
      target={href && href.startsWith('http') ? '_blank' : undefined}
      rel="noreferrer"
      onClick={(e) => {
        e.stopPropagation();
        if (!href) e.preventDefault();
      }}
      aria-disabled={href ? undefined : true}
    >
      {inner}
    </a>
  );
}

function TypeTag({ adType }: { adType: string | null | undefined }) {
  return <span className="ad-type-tag">{adType ?? 'no type'}</span>;
}