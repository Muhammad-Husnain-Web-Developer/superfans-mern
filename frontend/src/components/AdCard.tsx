import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AdLeadForm } from '../pages/ads/AdLeadForm';
import { HandleMarquee } from './PostHeading';
import { PremiumFanModal } from './PremiumFanModal';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { SubscribeModal } from '../pages/profile/SubscribeModal';
import { assetImage, formatNumberRounded, isVideoFile, likePercent, videoMime } from '../utils/format';
import { VolumeButton } from './VolumeButton';
import { RatingPill } from './RatingPill';
import { useRegisterModal } from './RegisterModal';
import { useRatingFeedback } from '../utils/useRatingFeedback';

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
  /** which of the type's button designs was ticked (spotify / amazon), see AD_BUTTON_VARIANTS */
  buttonVariant?: string | null;
  /** the advertiser's logo and @handle beside "Super Ads" on the wall — their own choice */
  showAdvertiserTag?: boolean;
  /** when the ad was bought; the date under the advertiser's name in the reel */
  createdAt?: string | null;
  /** promote-post only: shown as an ad (`ad`) or as an ordinary post (`post`) */
  promoteAs?: 'ad' | 'post' | null;
  /** promote-post only: the post's own 👁️ and ❤️💩, drawn under the tile instead of a button */
  post?: {
    views: number;
    likesCount: number;
    hatesCount: number;
    likePercent: number | null;
    viewerLiked: boolean;
    viewerHated: boolean;
  } | null;
}

/**
 * A promote-post ad with its post in hand. David, 5 Oct 2026: "Now don't have button — we just
 * promote a post with the 👁️ VIEWS and ❤️💩 as a normal post". Such a tile carries no call to
 * action; the post's own figures stand under it, and its creative opens the post itself.
 * One with no post on record (a migrated row whose post is gone) keeps the old button.
 */
export function isPromotedPost(item: Pick<AdCardItem, 'adType' | 'postId' | 'post'>): boolean {
  return item.adType === 'promote-post' && !!item.postId && !!item.post;
}

/** The advertiser picks both of these on the create form. */
export type AdButtonSize = 'small' | 'medium' | 'large';
/* The first three stand the button ON the creative. `outside` is the odd one: it puts the
   button under the tile, at the right, where a post carries its rating pill — David asked for
   it on 4 Oct 2026 ("It goes under the post bottom-right, in the place of Likes"), and the
   create form locks the size to small when it is chosen. */
export type AdButtonPosition = 'top' | 'center' | 'bottom' | 'outside';

export const AD_BUTTON_SIZES: AdButtonSize[] = ['small', 'medium', 'large'];
export const AD_BUTTON_POSITIONS: AdButtonPosition[] = ['top', 'center', 'bottom', 'outside'];

/** `outside` is drawn small and nothing else; the form greys the size out to say so. */
export const OUTSIDE_LOCKED_SIZE: AdButtonSize = 'small';

/** The client's six calls to action, and the branded buttons he drew for the outward types
    (Oct 2026). The branded ones all lead to the ad's own link, as More details does. */
export type AdAction =
  | 'more-details' | 'call' | 'send-card' | 'subscribe' | 'follow' | 'whatsapp'
  | 'instagram' | 'website' | 'tiktok' | 'twitch' | 'youtube' | 'itunes' | 'spotify'
  | 'ecommerce' | 'amazon-yellow' | 'amazon-white' | 'amazon-mono' | 'aliexpress' | 'temu';

/* His wording, in his languages — "Visitar Twitch" and "Ver Youtube" are Spanish on his
   own buttons, the rest English, and the Amazon/E-commerce ones read Comprar. */
export const AD_ACTION_LABEL: Record<AdAction, string> = {
  'more-details': 'More details',
  call: 'Call',
  'send-card': 'Send Card',
  subscribe: 'Subscribe',
  follow: 'Follow',
  whatsapp: 'Whatsapp',
  instagram: 'Visit Instagram',
  website: 'Visit Website',
  tiktok: 'Visit TikTok',
  twitch: 'Visitar Twitch',
  youtube: 'Ver Youtube',
  itunes: 'Listen on iTunes',
  spotify: 'Listen on Spotify',
  ecommerce: 'Comprar',
  'amazon-yellow': 'Comprar en Amazon',
  'amazon-white': 'Comprar en Amazon',
  'amazon-mono': 'Comprar en Amazon',
  aliexpress: 'Comprar en AliExpress',
  temu: 'Comprar en Temu',
};

/** The types whose create form lets the advertiser tick one of several button designs —
    "New Checkbox for select Button, same price" — in the order the form lists them. An ad
    with no choice on record draws the type's own button (Spotify), else the first. */
export const AD_BUTTON_VARIANTS: Partial<Record<string, AdAction[]>> = {
  spotify: ['itunes', 'spotify'],
  /* 'amazon-mono' (the yellow one in grey Consolas) is held back for now — David, 6 Oct 2026:
     "Hide this button, for moment we only have 2 buttons in Amazon". Its label, mark and
     styles stay, so putting it back is adding it to this list again (and to ads.routes). */
  amazon: ['amazon-yellow', 'amazon-white'],
  /* David, 6 Oct 2026: "Temu we have missing personalized Buttons — do the same as
     Spotify & iTunes" — one button for each store, the advertiser ticks which */
  'aliexpress-temu': ['aliexpress', 'temu'],
};

/**
 * Which call to action a tile carries, taken from what the ad was bought as. An advertiser
 * does not choose this on most types — the type already says what the ad is for — so the
 * mapping lives here and the tile stays honest about where its button leads.
 */
export function adAction(adType: string | null | undefined, buttonVariant?: string | null): AdAction {
  const variants = adType ? AD_BUTTON_VARIANTS[adType] : undefined;
  if (variants) {
    return (
      variants.find((v) => v === buttonVariant) ??
      variants.find((v) => v === adType) ??
      variants[0]
    );
  }
  switch (adType) {
    case 'instagram':
      return 'instagram';
    case 'website-visits':
      return 'website';
    case 'tiktok':
      return 'tiktok';
    case 'twitch':
      return 'twitch';
    case 'youtube':
      return 'youtube';
    case 'ecommerce':
      return 'ecommerce';
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
      /* promote-post with no post on record, and anything migrated without a type, lead
         outward under the plain button */
      return 'more-details';
  }
}

/**
 * Follow or Subscribe, settled by who bought the ad rather than by the ad. A creator who
 * charges is subscribed to; a free account, creator or not, is followed. Kept here so the
 * tile, the full-screen viewer and the Ads Center's own preview cannot drift apart — they
 * did once already, with the tile saying Follow for a paid creator.
 */
export function resolveAdAction(
  adType: string | null | undefined,
  advertiserPaid: boolean,
  buttonVariant?: string | null,
): AdAction {
  const base = adAction(adType, buttonVariant);
  return base === 'follow' && advertiserPaid ? 'subscribe' : base;
}

/** Whether an advertiser is one who charges — the same test the profile and viewer make. */
export function isPaidAdvertiser(a: { role?: string | null; priceOfSubscription?: number | null } | null | undefined): boolean {
  return a?.role === 'influencer' && (a?.priceOfSubscription ?? 0) > 0;
}

/** A `mailto:` is never followed from a tile: it does nothing on most machines, and it is
    the advertiser's own address. Anything else the Ads Center writes is left alone. */
function safeLink(link: string | undefined): string | null {
  if (!link) return null;
  return /^mailto:/i.test(link.trim()) ? null : link;
}

/**
 * Where the tile is standing. `wall` is the grid column it was drawn for; `fullscreen` is the
 * reel, where the creative has the screen to itself and the card carries no column classes.
 *
 * The client asked for the ads to appear in the full-screen scroll "same" as they do on the
 * wall — so only the frame changes here. The heading, the button, its size and position, and
 * every action behind it are the ones already agreed.
 */
export type AdCardVariant = 'wall' | 'fullscreen';

/**
 * An ad's video, behaving as a post's does.
 *
 * David, 4 Oct 2026: "Videos Ads don't have Video Controls. Just like a Post: Autoplay and
 * Volume ON/OFF." The post tiles were settled this way already — World.tsx carries the same
 * note, "two of them stacked on one card is what the client asked to be rid of" — and the ad
 * tile was simply missed, so it still drew the browser's own bar. That bar also swallowed the
 * tap meant to open the ad, which is the other half of the same report.
 *
 * On a wall nothing here starts the clip: `.autoplay-video` is what the page's own observer
 * (utils/video.ts) looks for, and it plays whichever visible clip should be playing and mutes
 * the rest. The reel has no such observer, so there the element starts itself.
 *
 * The id carries the variant as well as the ad: `toggleMute` finds its video by id, and the
 * same ad can be drawn by more than one tile on a page.
 */
function AdVideo({
  media,
  domId,
  fullscreen,
}: {
  media: string;
  domId: string;
  fullscreen: boolean;
}) {
  /**
   * The clip's own shape, read off the file once the browser knows it.
   *
   * In the reel a portrait clip is capped by height, so the picture is far narrower than the
   * column it sits in — 191px inside 296px on a 320px phone. The speaker is positioned
   * against this wrapper, and a wrapper that kept the column's width left it floating in the
   * black beside the picture instead of sitting on its corner. `fit-content` does not help:
   * it sizes from the file's own 720px width, not from the width the height cap leaves.
   * Giving the wrapper the clip's ratio is what makes the two boxes the same.
   */
  const [ratio, setRatio] = useState<number | null>(null);

  return (
    <div
      className="video-wrapper"
      style={
        fullscreen && ratio
          ? { position: 'relative', aspectRatio: String(ratio) }
          : { position: 'relative', width: '100%' }
      }
    >
      <video
        className="autoplay-video"
        id={domId}
        controlsList="nodownload"
        style={fullscreen && ratio ? { width: '100%', height: '100%' } : { maxWidth: '100%' }}
        autoPlay={fullscreen}
        loop
        muted
        playsInline
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          if (v.videoWidth && v.videoHeight) setRatio(v.videoWidth / v.videoHeight);
        }}
      >
        <source src={assetImage(media)} type={videoMime(media)} />
      </video>
      {/* the one control, in place of the native bar — it stops the click reaching the
          creative's own link, so turning the sound on does not also open the ad */}
      <VolumeButton videoId={domId} variant="world" />
    </div>
  );
}

export function AdCard({
  item,
  showType = false,
  variant = 'wall',
  onOpenFullscreen,
}: {
  item: AdCardItem;
  showType?: boolean;
  variant?: AdCardVariant;
  /**
   * What a click on the creative does, where the page can answer it.
   *
   * David, 4 Oct 2026: "If they Click in WORLD/WALLS, they open the Ad full screen." Until
   * now the creative led straight out to the advertiser's own address in a new tab — all 45
   * live ads carry a link and none promotes a post — so the full-screen ad could only be
   * reached by scrolling onto it in the reel. The wall passes this and the click opens the
   * ad instead; the call to action under it is still the way out to the advertiser.
   *
   * Left undefined by the Ads Center's preview, which has no reel to open.
   */
  onOpenFullscreen?: () => void;
}) {
  const isFullscreen = variant === 'fullscreen';
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const { t: tUi, i18n } = useTranslation('ui');
  /* the $10 that stands in front of writing when the advertiser is Busy */
  const [premiumOpen, setPremiumOpen] = useState(false);
  const media = item.media ?? '';
  const handle = item.advertiser?.usernameUrl ?? null;
  /* the same date the reel prints under a post's author: day, month and year in the
     reader's own language, with en-GB standing in for English so it reads "4 October 2026"
     rather than the American "October 4, 2026" (PostFullscreen does the same) */
  const dateLocale = (i18n.resolvedLanguage ?? 'en') === 'en' ? 'en-GB' : (i18n.resolvedLanguage ?? 'en');
  const postedOn = item.createdAt
    ? new Date(item.createdAt).toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const advertiserPaid = isPaidAdvertiser(item.advertiser);
  const action = resolveAdAction(item.adType, advertiserPaid, item.buttonVariant);

  /* already following / subscribed — the button has nothing left to ask for */
  const [done, setDone] = useState(
    action === 'subscribe'
      ? !!item.advertiser?.viewerSubscribed
      : !!item.advertiser?.viewerFollowing,
  );
  const [subOpen, setSubOpen] = useState(false);
  const [subBusy, setSubBusy] = useState(false);
  const advertiserId = item.advertiser?.id ?? null;
  /* An advertiser meets their own ad on the preview wall, and can meet it in their own
     feed. `POST /me/follow/:id` refuses that with a 400 — "You cannot follow yourself" —
     so the tile stopped asking. It still draws the button, because seeing the ad as
     others will is what the preview is for; it just does not fire the request. */
  const isOwnAd = !!authUser && !!advertiserId && authUser.id === advertiserId;

  /* Follow does both: the advertiser is followed and the viewer is taken to their
     profile. The request goes first so the profile it opens already shows Followed —
     it is awaited rather than fired past the navigation, since leaving the page mid-flight
     is what would make a click look like it did nothing. */
  async function follow() {
    if (!advertiserId) return;
    if (!isOwnAd && !done) {
      setDone(true);
      await api.post(`/me/follow/${advertiserId}`).catch(() => setDone(false));
    }
    if (handle) navigate(`/${handle}`);
  }

  /* the profile's own checkout, behind the profile's own dialog */
  function subscribe() {
    if (!advertiserId || subBusy || isOwnAd) return;
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
    /* the creative goes full screen, not to the profile — "FULL SCREEN + Following the
       user" — so it follows on its own rather than through follow() above */
    if (action === 'follow' && advertiserId && !isOwnAd && !done) {
      setDone(true);
      void api.post(`/me/follow/${advertiserId}`).catch(() => setDone(false));
    }
    navigate(`/user/post_detail/${item.postId}`, {
      state: action === 'subscribe' ? { subscribe: true } : undefined,
    });
    return true;
  }

  /* A clients-form ad walks the viewer through the advertiser's formulary in place rather
     than leading anywhere: its button opens the form over the tile. It used to be a tile of
     its own here — a second copy of the markup below — so every change to the ad tile had to
     be made twice, and the three David asked for on 4 Oct 2026 (no grey banner in the reel,
     the bottom bar, the `outside` button) reached only one of them. It is the same tile now;
     only what the button does, and the creative not being a link, set it apart.
     See `isLeadForm` below. */
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

  /* the advertiser's own formulary, opened over the tile rather than led to */
  const isLeadForm = item.adType === 'clients-form' && !!item.adId;

  if (isLeadForm) onClick = () => setFormOpen(true);
  else if (action === 'send-card' && advertiserId && handle)
    onClick = () =>
      advertiserBusy ? setPremiumOpen(true) : navigate(`/user/messages?to=${handle}`);
  else if (action === 'follow' && advertiserId) onClick = () => void follow();
  else if (action === 'subscribe' && advertiserId)
    onClick = () => { if (!isOwnAd) setSubOpen(true); };
  else href = safeLink(item.link);

  /* worked out once: the wall draws this button on the creative and the reel in its bottom
     bar, and the two must never read differently */
  const ctaLabel =
    item.buttonAction ||
    (done ? (action === 'subscribe' ? 'Subscribed' : 'Following') : AD_ACTION_LABEL[action]);

  /* `outside` is the one position that is not on the creative, so the button cannot live
     inside .ad-media with the other three — it is rendered after it, under the tile. The
     reel ignores the choice entirely; there the button is in the bottom bar. */
  const ctaOutside = !isFullscreen && (item.buttonPosition ?? 'bottom') === 'outside';

  /* The advertiser's own tag beside "Super Ads". Theirs to ask for — off on every ad bought
     before the box existed — and the reel never carries it: there the handle is already in
     the bottom bar, which is what David meant by "this don't affect on Full screen viewer". */
  /* A promoted post bought "As an Ad with Tags marks" always carries both tags — "with the
     SUPER ADS Tag and the @nickname tag". Bought "As a normal Post" it carries only the
     @nickname, like any post: WORLD draws those as ordinary posts, and the preview page,
     which draws every ad as a tile, should still show it the way it will be seen. */
  /* Every promote-post ad loses its button and carries the two tags — including one whose
     post is not on record (a live one links to /world instead of a post). Only the 👁️/❤️💩
     row, and opening the post itself, need the post: that is `promoted`. */
  const promoteAd = item.adType === 'promote-post';
  const promoted = isPromotedPost(item);
  const asNormalPost = promoteAd && item.promoteAs === 'post';
  const doubleTag =
    !isFullscreen && !!handle && (item.showAdvertiserTag === true || promoteAd);
  const wallCta = (
    <AdCta
      action={action}
      label={ctaLabel}
      href={href}
      onClick={onClick}
      size={ctaOutside ? OUTSIDE_LOCKED_SIZE : item.buttonSize ?? 'medium'}
      position={item.buttonPosition ?? 'bottom'}
      isForm={isLeadForm}
    />
  );

  return (
    <div className={isFullscreen ? 'ad-fullscreen' : 'col-md-4 col-sm-6 col-xs-6 col-xxs-12 work-item'}>
      {/* The grey bar heads the tile on the wall. In the reel David asked for it to go
          ("Take out GRAY COLOR Banner — just full screen", 4 Oct 2026): the creative has the
          screen to itself, and the label moves into the bottom bar beside the advertiser.

          The double tag is two boxes, side by side (David, 6 Oct 2026 — every ad, not only a
          promoted post): "Super Ads" standing still in one, and in the other the advertiser's
          own tag exactly as it was — their picture and @nickname, scrolling only when the
          name is too long for the box. It shows where the advertiser ticked "Show my logo and
          username", and always on a promoted post. Without it the tile keeps the one
          "Super Ads" box; a post bought "As a normal Post" keeps only the @nickname box. */}
      {!isFullscreen && doubleTag && !asNormalPost && (
        <div className="ad-card-heading-pair">
          <p className="feed_posts_heading_p ad-card-heading feed-heading-flex" style={{ fontSize: 14 }}>
            <span className="ad-card-super-ads-label">Super Ads</span>
          </p>
          <p className="feed_posts_heading_p ad-card-heading feed-heading-flex" style={{ position: 'relative', fontSize: 14 }}>
            <HandleMarquee
              handles={[{ usernameUrl: handle as string, profilePicture: item.advertiser?.profilePicture ?? null }]}
            />
          </p>
        </div>
      )}
      {!isFullscreen && !(doubleTag && !asNormalPost) && (
        <p className="feed_posts_heading_p ad-card-heading feed-heading-flex" style={{ position: 'relative', fontSize: 14 }}>
          <HandleMarquee
            leading={asNormalPost ? undefined : <span className="ad-card-super-ads-label">Super Ads</span>}
            handles={
              asNormalPost && handle
                ? [{ usernameUrl: handle, profilePicture: item.advertiser?.profilePicture ?? null }]
                : []
            }
          />
        </p>
      )}

      <div className="ad-media">
        {/* a lead-form ad's creative leads nowhere — the button opens the form */}
        {isLeadForm ? (
          <div className="ad-media-link">
            {isVideoFile(media) ? (
              <AdVideo media={media} domId={`video-ad-form-${item.id}`} fullscreen={isFullscreen} />
            ) : (
              <img
                src={assetImage(media)}
                alt={tUi('alt_advertisement')}
                className="img-responsive posttt-img"
                style={{ borderRadius: 26, border: '7px solid lightgray', width: '100%' }}
              />
            )}
          </div>
        ) : (
        <a
          className="ad-media-link"
          href={
            onOpenFullscreen
              ? `/user/post_detail/${item.id}`
              : item.postId
                ? `/user/post_detail/${item.postId}`
                : safeLink(item.link) ?? '#'
          }
          target={onOpenFullscreen || item.postId ? undefined : '_blank'}
          rel="noreferrer"
          onClick={(e) => {
            if (onOpenFullscreen) {
              e.preventDefault();
              onOpenFullscreen();
              return;
            }
            if (openPost()) e.preventDefault();
          }}
        >
          {isVideoFile(media) ? (
            <AdVideo
              media={media}
              domId={`video-ad-${isFullscreen ? 'fs' : 'wall'}-${item.id}`}
              fullscreen={isFullscreen}
            />
          ) : (
            <img
              src={assetImage(media)}
              alt={tUi('alt_advertisement')}
              className="img-responsive posttt-img"
              style={{ borderRadius: 26, border: '7px solid lightgray', width: '100%' }}
            />
          )}
        </a>
        )}

        {/* on the creative, at the size and place the advertiser chose — the wall only,
            and not when they asked for the button to stand outside it */}
        {!isFullscreen && !ctaOutside && !promoteAd && wallCta}
      </div>

      {/* under the tile, at the right, where a post carries its rating pill */}
      {ctaOutside && !promoteAd && <div className="ad-cta-outside-row">{wallCta}</div>}

      {/* a promoted post's own 👁️ and ❤️💩, where a WORLD post carries them */}
      {promoted && !isFullscreen && item.post && item.postId && (
        <PromotedPostStats postId={item.postId} stats={item.post} />
      )}

      {/* preview page only, under the tile rather than in its heading: in the heading it
          took the room "Super Ads" and the handle scroll in, so the tile stopped reading
          the way it does on WORLD */}
      {showType && !isFullscreen && (
        <div className="ad-type-caption">
          <TypeTag adType={item.adType} />
        </div>
      )}

      {/* The reel's bottom bar, built like the one a post carries (PostFullscreen): the
          advertiser's logo, their name over the ad's date, the "Super Ads" label beside
          them, and the call to action at the right. */}
      {isFullscreen && (
        <div className="ad-fs-bottombar">
          {handle ? (
            <a
              className="ad-fs-authorlink"
              href={`/${handle}`}
              onClick={(e) => { e.preventDefault(); navigate(`/${handle}`); }}
            >
              <img
                className="ad-fs-avatar"
                src={
                  item.advertiser?.profilePicture
                    ? assetImage(item.advertiser.profilePicture)
                    : assetImage('SUPERHEROINA.svg')
                }
                alt=""
              />
              <span className="ad-fs-author">
                <span className="ad-fs-name">{item.advertiser?.name || `@${handle}`}</span>
                {postedOn && <span className="ad-fs-date">{postedOn}</span>}
              </span>
            </a>
          ) : null
          /* Most migrated ads name no advertiser at all. The bar carried the date on its own
             for those, which read as a stray number against the black — David asked for the
             left of the bar to be empty instead (4 Oct 2026), leaving the label and the
             button at the right. */
          }
          {/* the label and the button wrap to the next line together, as one unit, rather
              than splitting across two lines of their own on a narrow phone */}
          <span className="ad-fs-tag-actions">
            {!asNormalPost && <span className="ad-fs-tag">Super Ads</span>}
            {!promoteAd && <AdCta action={action} label={ctaLabel} href={href} onClick={onClick} inBar />}
          </span>
        </div>
      )}

      {handle && (
        <SubscribeModal
          usernameUrl={handle}
          open={subOpen}
          busy={subBusy}
          onClose={() => setSubOpen(false)}
          onConfirm={subscribe}
        />
      )}

      {formOpen && item.adId && (
        <AdLeadForm
          adId={item.adId}
          media={media}
          link={item.link}
          onClose={() => setFormOpen(false)}
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
/* the branded buttons' marks: the network's own logo, or the emoji the client drew */
const BRAND_MARK: Partial<Record<AdAction, string>> = {
  instagram: '/brand/networks/scroll/instagram.svg',
  tiktok: '/brand/networks/scroll/tiktok.svg',
  twitch: '/brand/ads/twitch-white.svg',
  youtube: '/brand/networks/scroll/youtube.svg',
  itunes: '/brand/networks/scroll/itunes.svg',
  spotify: '/brand/ads/spotify.svg',
  'amazon-yellow': '/brand/networks/scroll/amazon.svg',
  'amazon-white': '/brand/networks/scroll/amazon.svg',
  'amazon-mono': '/brand/networks/scroll/amazon.svg',
  aliexpress: '/brand/ads/aliexpress.svg',
  temu: '/brand/ads/temu.svg',
  website: '\u{1F310}',
  ecommerce: '\u{1F6D2}',
};

export function CtaMark({ action }: { action: AdAction }) {
  const brand = BRAND_MARK[action];
  if (brand) {
    return (
      <span className="cta-mark" aria-hidden="true">
        {brand.startsWith('/') ? <img src={brand} alt="" /> : brand}
      </span>
    );
  }
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
  inBar = false,
}: {
  action: AdAction;
  label: string;
  href: string | null;
  onClick: (() => void) | null;
  size?: AdButtonSize;
  position?: AdButtonPosition;
  isForm?: boolean;
  /** standing in the reel's bottom bar rather than on the creative */
  inBar?: boolean;
}) {
  /* In the bar the advertiser's size and position say nothing: the button is no longer on
     the creative, so there is nothing to place it against and nothing to scale it by. It is
     drawn at one size there, like the Follow+ / Subscribe+ button it stands in for, and
     grows only with its own words (David, 4 Oct 2026). */
  let className = inBar
    ? `ad-cta-btn ad-cta-bar cta-${action}`
    : `ad-cta-btn cta-${action} size-${size} pos-${position}`;
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

/**
 * The row a WORLD post carries under its picture — 👁️ views, then ❤️ · %Liked/Hated · 💩 —
 * for a promoted post's tile. The figures are the post's own and the buttons act on the post,
 * so a like given to the ad is a like on the post. Same endpoints, same feedback, same guest
 * rule as WorldPostCard; a double-click on the picture is not wired here, since the picture
 * opens the post, where it is.
 */
function PromotedPostStats({ postId, stats }: { postId: string; stats: NonNullable<AdCardItem['post']> }) {
  const { user: authUser } = useAuth();
  const registerModal = useRegisterModal();
  const feedback = useRatingFeedback();
  const [liked, setLiked] = useState(stats.viewerLiked);
  const [hated, setHated] = useState(stats.viewerHated);
  const [likes, setLikes] = useState(stats.likesCount);
  const [hates, setHates] = useState(stats.hatesCount);

  const guardGuest = (run: () => void) => () => {
    if (!authUser) {
      registerModal.open();
      return;
    }
    run();
  };

  /* the server's answer settles both halves, whichever was pressed */
  const settle = (d: { status: string; likesCount: number; hatesCount: number }) => {
    setLikes(d.likesCount);
    setHates(d.hatesCount);
  };

  function toggleLike() {
    feedback.onLiked();
    const before = { liked, hated };
    setLiked(!liked);
    if (!liked) setHated(false);
    api
      .post<{ data: { status: string; likesCount: number; hatesCount: number } }>(`/posts/${postId}/like-toggle`)
      .then((r) => {
        const nowLiked = r.data.data.status === 'post liked';
        setLiked(nowLiked);
        if (nowLiked) setHated(false);
        settle(r.data.data);
      })
      .catch(() => {
        setLiked(before.liked);
        setHated(before.hated);
      });
  }

  function toggleHate() {
    feedback.onHated();
    const before = { liked, hated };
    setHated(!hated);
    if (!hated) setLiked(false);
    api
      .post<{ data: { status: string; likesCount: number; hatesCount: number } }>(`/me/hate/${postId}`)
      .then((r) => {
        const nowHated = r.data.data.status === 'post hated';
        setHated(nowHated);
        if (nowHated) setLiked(false);
        settle(r.data.data);
      })
      .catch(() => {
        setLiked(before.liked);
        setHated(before.hated);
      });
  }

  return (
    <div className="stats-wrapper has-actions">
      <div className="view-count">
        <span className="eye-icon">👁️</span>
        <span className="number_of_post_likes" style={liked ? { color: '#da1212' } : undefined}>
          {formatNumberRounded(stats.views)}
        </span>
      </div>
      <RatingPill
        pct={likePercent(likes, hates, stats.likePercent, { id: postId, views: stats.views })}
        liked={liked}
        hated={hated}
        beat={feedback.beat}
        bounce={feedback.bounce}
        onLike={guardGuest(toggleLike)}
        onHate={guardGuest(toggleHate)}
      />
    </div>
  );
}

function TypeTag({ adType }: { adType: string | null | undefined }) {
  return <span className="ad-type-tag">{adType ?? 'no type'}</span>;
}