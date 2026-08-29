import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdLeadForm } from '../pages/ads/AdLeadForm';
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
  /** the advertiser, for the actions that lead back to a profile */
  advertiser?: { usernameUrl: string | null; name?: string | null } | null;
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
    case 'profile-followers':
      return 'follow';
    case 'messages':
      return 'send-card';
    case 'youtube':
      /* card 7, "Promote Youtube Content" — Subscribe is YouTube's own word for it. It was
         wired to `super-video` before, which is not an ad type at all: the Ads Center's
         Super Video card (14) is sold as `website-visits`, so no ad could ever have shown
         this button. */
      return 'subscribe';
    default:
      /* website-visits, instagram, tiktok, twitch, amazon, spotify, promote-post and
         anything migrated without a type all lead outward */
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
  const media = item.media ?? '';
  const action = adAction(item.adType);
  const handle = item.advertiser?.usernameUrl ?? null;

  /* A clients-form ad is its own tile: the creative with the advertiser's button under it,
     walking the viewer through the formulary in place rather than leading anywhere.
     We now render the tile like any other ad, with the button respecting size/position,
     and open the form in a modal when clicked. */
  if (item.adType === 'clients-form' && item.adId) {
    const label = item.buttonAction || AD_ACTION_LABEL[action];

    return (
      <>
        <div className="col-md-4 col-sm-6 col-xs-6 col-xxs-12 work-item">
          <p className="feed_posts_heading_p" style={{ position: 'relative', fontSize: 14 }}>
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
  const inApp = action === 'follow' || action === 'subscribe' || action === 'send-card';
  let href: string | null = null;
  let onClick: (() => void) | null = null;

  if (inApp && handle) onClick = () => navigate(`/${handle}`);
  else href = safeLink(item.link);

  return (
    <div className="col-md-4 col-sm-6 col-xs-6 col-xxs-12 work-item">
      <p className="feed_posts_heading_p" style={{ position: 'relative', fontSize: 14 }}>
        <span>Super Ads</span>
        {showType && <TypeTag adType={item.adType} />}
      </p>

      <div className="ad-media">
        <a className="ad-media-link" href={safeLink(item.link) ?? '#'} target="_blank" rel="noreferrer">
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
          label={item.buttonAction || AD_ACTION_LABEL[action]}
          href={href}
          onClick={onClick}
          size={item.buttonSize ?? 'medium'}
          position={item.buttonPosition ?? 'bottom'}
        />
      </div>
    </div>
  );
}

/** The mark the client draws beside each label, taken from the cards in /ads-images:
    a red flag on Subscribe and Follow, a green disc on Whatsapp, and an emoji on the
    other three. The flag and the disc are drawn rather than borrowed from an emoji font,
    which renders them differently on every machine. */
function CtaMark({ action }: { action: AdAction }) {
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

  const markFirst = action === 'call' || action === 'send-card';
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