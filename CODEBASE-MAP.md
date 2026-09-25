# Superfans-MERN — Codebase Map

> Auto-generated reference for handing this project to another AI assistant (e.g. DeepSeek)
> without giving it direct repo access. Generated 2026-09-22.

## How to use this with an AI that has no repo access

1. Paste this **whole file** into the chat first, plus a short note on your task.
2. The assistant should read the file list + summaries below, then tell you exactly which
   file(s) it needs the full contents of — usually 1-4 files.
3. Paste those files (open them in your editor, copy-paste, or `cat` them in a terminal).
4. Get the fix back as either the complete updated file, or an exact find-and-replace
   (old block → new block) you can apply by hand.

**Rules to give the assistant along with this file:**
- This is the **MERN rewrite** of an older Laravel app. The Laravel original (a separate,
  read-only folder, not included here) is the design/behaviour source of truth for anything
  being *ported*; for features with no Laravel original (Stories, the rating pill, geo/reach),
  your own instructions decide.
- **Never invent a file path, export name, CSS class, or API route** that isn't listed below —
  ask for the file instead of guessing.
- Backend: Express 5 + TypeScript + Mongoose, MongoDB. Frontend: React 19 + TypeScript + Vite,
  react-router-dom, i18next (8+ locales), axios. Styling is mostly plain CSS files extracted
  from the Laravel theme, not Tailwind utility classes (Tailwind is present but barely used).
- Auth: JWT in httpOnly cookies (`sf_access`/`sf_refresh`). Roles: `user`, `influencer`,
  `business`, `admin`.
- Give back either the **complete updated file** (if under ~200 lines) or an **exact
  find-and-replace** (verbatim old block, then new block) — never "add this somewhere near
  the top", since you're applying these by hand.
- State one or two concrete things to verify afterwards (a URL to open, a size to check).

---

## Project structure at a glance

```
backend/src
  app.ts, server.ts        Express app + HTTP server bootstrap
  config/                  env loading, DB connect, logger
  controllers/              (mostly logic lives inline in routes/ instead)
  data/                    static data (merch catalogue)
  middleware/              auth (requireAuth/optionalAuth), error handling, presence tracking
  models/                  Mongoose schemas (User, Post, Like, Hate, Followership, Subscription,
                            Story, Ad, ads.ts, adminEntities.ts, News, ChatMessage, ReachLock…)
  routes/                  one router per feature area — see the table below for endpoints
  services/                mailer, email templates, storage (uploads), payments/, realtime (socket.io)
  utils/                   jwt, geo, reach (the country/travel-ladder algorithm), worldReach,
                            tagged-avatars
  validators/              zod schemas

frontend/src
  App.tsx                  the whole route table + route guards
  api/                     axios client + typed API calls
  context/                 AuthContext (user + role)
  pages/                   one folder per feature area (world/, profile/, ads/, admin/, auth/,
                            chat/, news/, rankings/, stories/, stream/, merch/, errors/)
  components/              shared UI pieces (RatingPill, PostHeading, VolumeButton, NavToggle,
                            RegisterModal, MobileFooterMenu, stories/*, …)
  styles/                  plain CSS files, mostly extracted from the Laravel theme
  utils/                   format.ts (assetImage, videoMime, likePercent, likeLevel…), video.ts,
                            postSounds.ts, useRatingFeedback.ts, businessAccess.ts,
                            useScrollMemory.ts, feedMemory.ts, worldSequence.ts
  i18n/                    index.ts + locales/{en,es,ca,fr,de,it,pt,cn,ru,nl}/*.json
```

---

## `backend/src/`

### `backend/src/app.ts` (67 lines)

nginx sits in front of this process and forwards every request over the loopback, so without this `req.ip` is nginx's own address and never the visitor's. It was: of the 563 post visits recorded on the live server in the last thirty days, all 563 read `::ffff:127.0.0.1`. `loopback` rather than a hop count or `true`: only a proxy on 127.0.0.1 is believed, which is exactly our nginx. A visitor cannot then hand us a forged `X-Forwarded-For` and be taken at their word, which `true` would allow — and the country a post is stamped with is about to depend on this being honest.

**Exports:** `createApp`

### `backend/src/server.ts` (33 lines)

_(no leading comment found — read the file directly)_

## `backend/src/config/`

### `backend/src/config/db.ts` (19 lines)

**Exports:** `connectDB`, `disconnectDB`

### `backend/src/config/env.ts` (63 lines)

Read-only path to the original Laravel public/assets/images so migrated media resolves in dev

**Exports:** `env`, `isProd`

### `backend/src/config/logger.ts` (13 lines)

**Exports:** `logger`

## `backend/src/controllers/`

### `backend/src/controllers/auth.controller.ts` (185 lines)

**Exports:** `register`, `login`, `refresh`, `me`, `logout`, `forgotPassword`, `resetPassword`

## `backend/src/data/`

### `backend/src/data/merchProducts.ts` (255 lines)

**Exports:** `merchProducts`

## `backend/src/middleware/`

### `backend/src/middleware/asyncHandler.ts` (11 lines)

Wrap async route handlers so rejections reach the error middleware.

**Exports:** `asyncHandler`

### `backend/src/middleware/auth.ts` (52 lines)

Requires a valid access-token cookie.

**Exports:** `requireAuth`, `optionalAuth`, `requireRole`, `notBusiness`

### `backend/src/middleware/errors.ts` (73 lines)

Operational error with an HTTP status — throw anywhere, the handler formats it. */

**Exports:** `notFoundHandler`, `errorHandler`, `ApiError`

### `backend/src/middleware/trackPresence.ts` (125 lines)

Keeps `user.current` pointing at wherever the account was last opened from. The client asked for this to be read quietly off the address rather than asked for: "we detect it silently by IP". It sits in front of the whole API rather than on any one route, because the answer is wanted from whatever the reader happens to open first. Two things keep it cheap. Nothing is written unless the place has actually changed or the last sighting has gone stale, and the write is never waited on — a reader should not spend a round trip to the database on bookkeeping that is not part of their answer. A failure here is swallowed for the same reason: losing one sighting is not worth failing a request the reader did ask for.

**Exports:** `trackPresence`

## `backend/src/models/`

### `backend/src/models/Ad.ts` (47 lines)

Sidebar/feed ad (mirrors MySQL `ads`). */

**Exports:** `Ad`, `IAd`

### `backend/src/models/adminEntities.ts` (190 lines)

Admin-managed entities (mirror the MySQL tables behind the Laravel admin panel): - Coupon: discount codes - Package + PackageInclude: subscription packages and their feature flags - Modal: a merch/avatar product (name, price, icon, image) - Asset: an avatar-customization asset (icon/overlay with a z-index and parent) - WaterMark: an uploaded watermark image - Cart: a merch order (avatar part slots + payment status)

**Exports:** `Coupon`, `Package`, `PackageInclude`, `Modal`, `Asset`, `WaterMark`, `Cart`, `ICoupon`, `IPackage`, `IPackageInclude`, `IModal`, `IAsset`, `IWaterMark`, `ICart`

### `backend/src/models/ads.ts` (216 lines)

Ads Center models (mirror the MySQL tables behind the Super-Ads module): - AdUserProfile: the advertiser's billing/agency profile (gate before creating ads) - AdCampaign + AdCampaignDetail: the campaign record with dynamic key/value details - Ad: the concrete ad (with link, type, approval, impressions/clicks) shown to viewers - AdFormularyForm + AdFormularyLead: the clients-form lead-capture form and its leads - AdPayment: a recorded payment against an Ad

**Exports:** `AD_TYPES`, `AdUserProfile`, `AdCampaign`, `AdCampaignDetail`, `AdFormularyForm`, `AdFormularyLead`, `AdPayment`, `IAdUserProfile`, `IAdCampaign`, `IAdCampaignDetail`, `IAdFormularyForm`, `IAdFormularyLead`, `IAdPayment`, `AdType`, `Ad`, `type IAd`

### `backend/src/models/ChatMessage.ts` (27 lines)

A one-to-one chat message (mirrors MySQL `chatbox`: sender → receiver + text).

**Exports:** `ChatMessage`, `IChatMessage`

### `backend/src/models/Followership.ts` (22 lines)

Free follow (mirrors MySQL `followerships`).

**Exports:** `Followership`, `IFollowership`

### `backend/src/models/Hate.ts` (26 lines)

"Hate" (dislike) on a post (mirrors MySQL `hates`).

**Exports:** `Hate`, `IHate`

### `backend/src/models/Like.ts` (23 lines)

**Exports:** `Like`, `ILike`

### `backend/src/models/News.ts` (31 lines)

Site news item (mirrors MySQL `news`): a title/content card with an optional image and an optional call-to-action button.

**Exports:** `News`, `INews`

### `backend/src/models/PasswordReset.ts` (17 lines)

**Exports:** `PasswordReset`, `IPasswordReset`

### `backend/src/models/Post.ts` (99 lines)

media filename (image or video) in /assets/images, as in Laravel

**Exports:** `Post`, `IPost`

### `backend/src/models/PostVisit.ts` (24 lines)

Post view tracking (mirrors MySQL `post_visits`).

**Exports:** `PostVisit`, `IPostVisit`

### `backend/src/models/PremiumAccess.ts` (40 lines)

A fan's paid priority access to one creator's inbox — the blade's "premium fan". user_profile.blade.php:1310-1345 puts a creator who has switched their chat off behind a $10 one-off: the ✉️ button raises "Super Busy!", then "🏅 Priority Access – $10", and the payment lets that fan write to them anyway. Laravel checks it with `hasPaidInfluencer`; one row here is that check. It is a one-off, not a subscription — the blade's own words: "This premium subscription won't be renewed next month, don't worry! It's only for 1 use." Paying twice for the same creator is therefore pointless, so the pair is unique. /

**Exports:** `PremiumAccess`, `IPremiumAccess`

### `backend/src/models/Presence.ts` (50 lines)

One row for each day an account was seen in a country. This is what the client's ladder counts. He set the test himself: somebody must not be able to "be 15 days with 14 days without login, and post 45 videos in 1 day". Counting days of *presence* rather than days on the calendar is what makes that impossible — a day only exists here if the account was actually opened from that country on it, so posting forty-five times in one sitting still earns exactly one day. A row is never updated, only created, and the index below is what keeps it to one per day: `trackPresence` attempts an insert on every sighting and the duplicate is discarded. The day is the UTC date. A traveller crossing a timezone at midnight may have a day land on one side or the other of what their own clock says; over the 5, 15 and 38-day thresholds the client set, that is not a difference worth carrying a per-user timezone for.

**Exports:** `utcDay`, `Presence`, `IPresence`

### `backend/src/models/ReachLock.ts` (66 lines)

A rule the owner writes over the reach the ladder works out — the two "lockers" the client asked for on his admin panel. `zone` — posts made in one place, shown in another: "Country Zone Post Locker". `user` — one account's posts, shown in a place: "User Individual Locker Country". A place is a country and, when the rule is meant for one region only — the client named Catalunya — the region inside it. Left blank, the rule covers the whole country. Cities he withdrew himself. The figure is the last word where the rule matches: 0 shuts the door and 100 opens it, and anything between is read the way every other reach figure is, as each post's chance of appearing there. Nothing here is computed; it exists only because somebody wrote it.

**Exports:** `ReachLock`, `LockPlace`, `IReachLock`

### `backend/src/models/SocialNetwork.ts` (25 lines)

sidebar/inline icon filename in /assets/images

**Exports:** `SocialNetwork`, `ISocialNetwork`

### `backend/src/models/Story.ts` (86 lines)

How long a story stays up. The client asked for Instagram's 24 hours. */

**Exports:** `STORY_LIFETIME_MS`, `STORY_MAX_VIDEO_SECONDS`, `Story`, `IStoryElement`, `IStory`

### `backend/src/models/StreamRoom.ts` (27 lines)

A live-stream room (mirrors MySQL `stream_rooms`): the creator opens one with a bio + tags before going live, and the broadcaster page is keyed by `roomName`.

**Exports:** `StreamRoom`, `IStreamRoom`

### `backend/src/models/Subscription.ts` (35 lines)

Paid subscription fan→creator (mirrors MySQL `subscriptions`).

**Exports:** `Subscription`, `ISubscription`

### `backend/src/models/User.ts` (246 lines)

what the creator has been paid for Super Video ads — shown as its own line in the control panel, set by hand from the admin table. Kept beside `earnings` rather than inside it: the total is what a withdrawal draws on, and this is a breakdown.

**Exports:** `User`, `IUser`, `UserRole`, `UserStatus`

### `backend/src/models/UserBlock.ts` (24 lines)

Block relationship (mirrors MySQL `user_blocks` pivot).

**Exports:** `UserBlock`, `IUserBlock`

## `backend/src/routes/`

### `backend/src/routes/admin.routes.ts` (861 lines)

Admin guard — Laravel gates the panel on the `admin` middleware (role admin / id 4465). Id 100 is here for the same reason it is written into the blade's own controller: InfluencerController::all_users answers only `$logged == '100'`, and that account is the owner's. His role stays `influencer`, which is what his public profile is built on, so the id is what grants the panel.

**Exports:** `adminRouter`, `LIKE_PERCENT_SPREAD`

**Endpoints:**
- `GET /stats`
- `GET /users`
- `GET /users/:id`
- `PUT /users/:id`
- `DELETE /users/:id`
- `GET /all-users`
- `POST /users/:id/suspend`
- `POST /users/:id/delete-toggle`
- `POST /users/:id/followers`
- `GET /users/:id/posts`
- `POST /posts/:id/likes`
- `POST /posts/:id/like-percent`
- `POST /users/:id/like-percent`
- `GET /ad-management`
- `POST /ad-management`
- `POST /ad-management/:id/toggle`
- `POST /ad-management/:id/delete`
- `POST /growth/:userId`
- `POST /growth/process/run`
- `GET /coupons`
- `GET /coupons/:id`
- `POST /coupons`
- `PUT /coupons/:id`
- `DELETE /coupons/:id`
- `GET /packages`
- `GET /packages/:id`
- `PUT /packages/:id`
- `GET /watermarks`
- `POST /watermarks`
- `PUT /watermarks/:id`
- `DELETE /watermarks/:id`
- `GET /models`
- `GET /models/:id`
- `POST /models`
- `PUT /models/:id`
- `DELETE /models/:id`
- `GET /assets`
- `GET /assets/:id`
- `POST /assets`
- `PUT /assets/:id`
- `DELETE /assets/:id`
- `GET /orders`
- `GET /orders/:id`
- `GET /reach-locks`
- `POST /reach-locks`
- `PUT /reach-locks/:id`
- `DELETE /reach-locks/:id`

### `backend/src/routes/ads.routes.ts` (1067 lines)

The dashboard card set — mirrors the validTypes used across the Laravel controllers.

**Exports:** `adsRouter`

**Endpoints:**
- `POST /vip-request`
- `GET /center`
- `POST /profile`
- `GET /preview`
- `GET /posts`
- `GET /type/:type`
- `GET /my-ads`
- `GET /information`
- `GET /potential-clients`
- `POST /store/:type`
- `POST /initiate-payment/:type`
- `POST /pay-existing`
- `GET /campaign/:type/:id`
- `DELETE /:id`
- `PUT /campaign/:id/toggle`
- `DELETE /campaign/:id`
- `GET /formulary/:adId`
- `POST /formulary/:adId/lead`
- `GET /all`
- `PUT /:id/approve`
- `PUT /:id/reject`
- `PUT /:id/toggle-status`

### `backend/src/routes/auth.routes.ts` (15 lines)

**Exports:** `authRouter`

**Endpoints:**
- `POST /register`
- `POST /login`
- `POST /refresh`
- `POST /logout`
- `GET /me`
- `POST /forgot-password`
- `POST /reset-password`

### `backend/src/routes/chat.routes.ts` (110 lines)

Chat — port of ChatboxController. The Laravel API takes user ids in the body (user_id / influencer_id / sender_id / receiver_id); here the *sender* is always the authenticated user, and the counterpart id is validated to belong to a real user. Messages are stored one-to-one and delivered in real time over Socket.io.

**Exports:** `chatRouter`

**Endpoints:**
- `GET /users`
- `POST /fetch`
- `POST /send`

### `backend/src/routes/geo.routes.ts` (120 lines)

Countries and their cities, for every form that asks where somebody is. Laravel pulled this off countriesnow.space from the browser — every country in the world, and on picking one, that country's whole city list. We serve the same thing from the `country-state-city` dataset instead, so the form does not depend on a third party being up and the browser only ever downloads the one country it asked for (the full set is 148k cities — far too much to ship in the bundle). The dataset is loaded on the first request rather than at boot: it costs ~80 MB of memory, which a server nobody has opened the ads form on should not be paying.

**Exports:** `geoRouter`

**Endpoints:**
- `GET /countries`
- `GET /regions`
- `GET /cities`

### `backend/src/routes/index.ts` (91 lines)

**Exports:** `apiRouter`

**Endpoints:**
- `GET /ads/random`
- `GET /social-networks`
- `GET /health`

### `backend/src/routes/me.routes.ts` (608 lines)

Account settings — ports the many single-field endpoints the blade's control panel posts to (update_name / update_surname / update_email / update_password / update_bio / update_username_url / updateCoverColor / update_birth / update_country / update_gender / footer_name_username, and the image updates). Laravel exposes one route per field; we accept them together but keep the exact validation rules (unique email, unique username, bio max 500).

**Exports:** `meRouter`

**Endpoints:**
- `PATCH /settings`
- `POST /networks`
- `PATCH /first-network`
- `GET /control-panel-lists`
- `DELETE /followership/:id`
- `DELETE /incoming/:type/:id`
- `PATCH /networks/:networkId`
- `DELETE /networks/:networkId`
- `POST /request-creator-account`
- `POST /follow/:id`
- `DELETE /follow/:id`
- `POST /relations`
- `POST /hate/:postId`
- `GET /feed`
- `GET /check-duplicate`
- `POST /verify-password`
- `POST /withdraw-earnings`

### `backend/src/routes/merchandising.routes.ts` (59 lines)

The catalogue is hardcoded in Laravel's MerchandisingController; extracted verbatim.

**Exports:** `merchandisingRouter`, `MerchProduct`

**Endpoints:**
- `GET /`
- `GET /:slug`

### `backend/src/routes/news.routes.ts` (109 lines)

optional base64 data URL for a new image

**Exports:** `newsRouter`

**Endpoints:**
- `GET /`
- `GET /:id`
- `POST /`
- `PATCH /:id`
- `DELETE /:id`

### `backend/src/routes/og.routes.ts` (123 lines)

Server-rendered Open Graph tags, for link-preview crawlers only (WhatsApp, Facebook, Twitter, Slack, Discord, Telegram, …). They fetch a URL and read whatever meta tags are already in the raw HTML — they do not run this app's JavaScript — so the plain SPA shell they would otherwise receive carries no image at all, for any page, including a creator's own profile. David caught this sharing @ellaesari's profile link on WhatsApp: the preview card showed no photo. nginx sends only requests with a crawler user-agent here (see nginx.conf.example); every browser keeps receiving the built SPA straight off disk, unchanged. This mirrors what Laravel already did per-request — user_profile.blade.php filling `og_image` with `$user->profile_picture`, layouts_direct_user/main.blade.php's site-wide default otherwise — so it is a port of existing behaviour, not a new feature.

**Exports:** `ogRouter`

### `backend/src/routes/payments.routes.ts` (461 lines)

the address AdsPaymentController mails on every ad payment

**Exports:** `paymentsRouter`, `PREMIUM_ACCESS_AMOUNT`

**Endpoints:**
- `POST /premium/:influencerId`
- `GET /config`
- `POST /subscribe/:influencerId`
- `DELETE /subscription/:influencerId`
- `POST /merch/checkout`
- `POST /verified`
- `DELETE /verified`
- `POST /stream-boost`
- `POST /donation`
- `GET /verify/:reference`
- `POST /webhook`

### `backend/src/routes/posts.routes.ts` (310 lines)

ffmpeg frame @1s, same command as Laravel's add_post; silently skipped when unavailable.

**Exports:** `postsRouter`

**Endpoints:**
- `POST /`
- `DELETE /:id`
- `POST /:id/toggle-visibility`
- `POST /toggle-all-visibility`
- `POST /:id/like-toggle`
- `POST /:id/visit`
- `GET /:id`

### `backend/src/routes/profiles.routes.ts` (258 lines)

Public profile by vanity URL — mirrors Laravel's fallback route (UserController@user_profile): 404 when missing, distinct response for suspended accounts, otherwise profile + latest posts.

**Exports:** `profilesRouter`

**Endpoints:**
- `GET /:usernameUrl`
- `GET /:usernameUrl/subscribers`
- `GET /:usernameUrl/posts`

### `backend/src/routes/rankings.routes.ts` (83 lines)

Leagues — exact port of RankingController@index: every list is `users ORDER BY no_of_followers DESC` with these windows — superMagic 0..11, superLeague 0..50, diamond 50..150, emerald 150..250, gold 250..500, silver 500..1000, bronze 1000..1004 (empty when ≤1000 users).

**Exports:** `rankingsRouter`

**Endpoints:**
- `GET /`
- `GET /bronze`

### `backend/src/routes/stories.routes.ts` (288 lines)

How many creators the feed strip carries at once.

**Exports:** `storiesRouter`

**Endpoints:**
- `POST /`
- `GET /`
- `GET /user/:usernameUrl`
- `POST /:id/view`
- `DELETE /:id`

### `backend/src/routes/stream.routes.ts` (84 lines)

Create a stream room — port of StreamController@createRoom. The creator supplies a bio + tags; we mint a unique room name and return it so the client can open the broadcaster page at /start-stream/:room.

**Exports:** `streamRouter`

**Endpoints:**
- `POST /create-room`
- `GET /stream/room/:roomName`
- `GET /streamtoken`

### `backend/src/routes/uploads.routes.ts` (29 lines)

**Exports:** `uploadsRouter`

**Endpoints:**
- `POST /profile-image`
- `POST /cover-image`

### `backend/src/routes/users.routes.ts` (187 lines)

**Exports:** `usersRouter`

**Endpoints:**
- `POST /:id/block`
- `POST /:id/unblock`
- `POST /reports/user`
- `POST /reports/post`
- `POST /reports/story`
- `GET /influencers`
- `GET /search/influencers`

### `backend/src/routes/world.routes.ts` (444 lines)

buildAd writes `<app>/post/<id>` for the three picker types (promote-post, profile-followers, messages); anything else is an outward link and has no post. Ads migrated from Laravel carry the MySQL row number there instead — `/post/714` — which is resolved against Post.mysqlId rather than left to fail.

**Exports:** `worldRouter`

**Endpoints:**
- `GET /`

## `backend/src/services/`

### `backend/src/services/adEmails.ts` (269 lines)

The six mails the blade sends around ads and price changes, which the rewrite had not carried over. Each one reproduces its blade word for word -- resources/views/emails/*.blade.php -- including the wording, the ordering of the details and the sign-offs, since the client reads these closely. The subjects come from the Mailable classes in app/Mail; NotifyUserPriceIncreaseMail sets none, so Laravel falls back to the humanised class name, and that is the subject used here. /

**Exports:** `adCreatedUser`, `adCreatedAdmin`, `vipAccessRequestAdmin`, `adPaymentSuccessUser`, `adPaymentSuccessAdmin`, `adStatusChanged`, `priceIncrease`, `Mail`

### `backend/src/services/emailTemplate.ts` (176 lines)

The shell every outgoing mail is wrapped in — the old design, rebuilt. Laravel sends through its notification layout, and the client had already put the logo into that layout's header (the framework's own html/header.blade.php in vendor was edited to print SuperfansT-01.png at 150px). The client asked for those mails back, with the logo centred in the blue-grey field. Every value below is that theme's (Illuminate/Mail/resources/views/html/themes/default.css): field #edf2f7 · card 570px #ffffff, 1px #e8e5ef, radius 2px · heading #3d4852 18px text #718096 16px/1.5 · button #2d3748 with the 8/18px border padding · footer #b0adc5 12px Written as tables with inline styles because that is what mail clients understand — Outlook has no flexbox, and <style> blocks are often stripped (the media queries below are the one thing that has to live in a block, and the layout stands without them). /

**Exports:** `renderEmailHtml`, `renderEmail`

### `backend/src/services/mailer.ts` (43 lines)

Some hosts advertise an AAAA record for the SMTP host that is not actually routable from where this runs — Node's default DNS order then tries IPv6 first and the connection fails with ENETUNREACH, even though the same host answers instantly over IPv4. Found while testing the 16 Sep price-rise mail: every outgoing mail shares the one transporter below, so an unroutable IPv6 path would silently kill all of them, not just this one — sendMail's own caller sites swallow the error (`.catch(() => undefined)`), so nothing would ever surface it. `ipv4first` is Node's own documented fix for this exact symptom (Node ≥17).

**Exports:** `sendMail`

### `backend/src/services/realtime.ts` (50 lines)

Socket.io real-time layer (the approved chat upgrade). Each authenticated socket joins a room named after its user id; `emitToUser` pushes an event to that room, so a message reaches every tab the recipient has open — instantly, no polling.

**Exports:** `initRealtime`, `emitToUser`

### `backend/src/services/storage.ts` (84 lines)

Media storage service. `local` driver keeps the Laravel behavior: files land in one directory and are served under /assets/images/<filename>, so legacy DB filenames keep resolving. A `cloudinary` driver plugs in here for production later. /

**Exports:** `uploadsDir`, `saveBase64Image`, `saveBase64Media`

### `backend/src/services/videoDuration.ts` (101 lines)

How long a video runs, read straight out of the file. The VPS has no ffmpeg or ffprobe (checked 2026-08-22), so the usual `ffprobe -show_format` is not available and installing it needs root. MP4 and MOV — which is everything a phone or a browser produces here — carry the answer in their own header: the `moov` box holds an `mvhd` box with a timescale and a duration, and dividing one by the other gives seconds. That is a few hundred bytes to read, not a transcode. Returns null when the container is something else (WebM, Ogg) or the header is malformed. A null means "unknown", never "fine" — the caller decides what to do with an unknown.

**Exports:** `probeVideoDurationSeconds`

## `backend/src/services/payments/`

### `backend/src/services/payments/index.ts` (20 lines)

The active payment provider, chosen by PAYMENT_PROVIDER. To add PayPal/Verotel/Redsys later, implement PaymentProvider in a new file and register it here — nothing else in the app changes.

**Exports:** `paymentProvider`

### `backend/src/services/payments/stripe.ts` (142 lines)

Stripe adapter — implements PaymentProvider with Stripe Checkout Sessions. Prices are created inline (price_data) so no dashboard product setup is needed; recurring subscriptions are handled by Stripe itself (renewals arrive as webhooks), which removes the recurring-charge cron the Redsys path would have needed.

**Exports:** `StripeProvider`

### `backend/src/services/payments/types.ts` (72 lines)

Payment-provider abstraction. Every gateway (Stripe today; PayPal / Verotel / Redsys later) implements this one interface, and the app is wired only to the interface — so switching gateways is a new adapter file + the PAYMENT_PROVIDER env var, nothing more. The model is "hosted checkout + redirect": the provider returns a URL we send the browser to; the gateway takes the payment on its own page and calls our webhook. This is the safest common denominator and matches how Stripe Checkout, PayPal, Verotel and Redsys all work.

**Exports:** `CheckoutRequest`, `CheckoutResult`, `WebhookEvent`, `PaymentProvider`, `CheckoutMode`, `WebhookEventType`

## `backend/src/utils/`

### `backend/src/utils/geo.ts` (105 lines)

Where a request came from, for the country rules the client set out. Laravel asks a third party for this (`Location::get($ip)`, stevebauman/location). We read it from a database that ships with the process instead: the answer is wanted on every session and on every post, and a lookup that costs a network round trip — and a rate limit, and an outage when the other end is down — is the wrong shape for that. Measured here: 85ms once to load the data, then 0.003ms a lookup, against 141MB of memory held for the life of the process. That memory is only paid once something actually asks, which is why the import below is deferred rather than taken at boot — the same bargain `geo.routes.ts` strikes with its own large dataset.

**Exports:** `clientIp`, `placeFromIp`, `placeFromRequest`, `Place`

### `backend/src/utils/jwt.ts` (55 lines)

**Exports:** `signAccessToken`, `signRefreshToken`, `verifyAccessToken`, `verifyRefreshToken`, `setAuthCookies`, `clearAuthCookies`, `ACCESS_COOKIE`, `REFRESH_COOKIE`, `AccessTokenPayload`, `RefreshTokenPayload`, `UserRole`

### `backend/src/utils/reach.ts` (141 lines)

How far into a country an account reaches, in the client's own terms. His rule is that a post belongs to the WORLD of the country it was posted from, and that the only way out of that is to go there: "we make travel the people for be famous". The figure below is what that travel has earned, and it is read as a chance per post — his answer (c), not a share of anybody's feed. Seven travellers on 15% do not fill a country's WORLD between them; each of their posts simply has fifteen chances in a hundred of appearing there.

**Exports:** `tierFor`, `effortIn`, `reachIn`, `refreshEarned`, `earnedIn`, `maybeMoveHome`, `LADDER`, `HOME_DAYS`, `NEW_HOME_PERCENT`, `HOME_PERCENT`

### `backend/src/utils/tagged-avatars.ts` (49 lines)

Fills in the avatar for every tagged handle a post is missing one for. `taggedProfilePictures` is a snapshot taken when the post was written, and it runs short — of the posts carrying a tag, roughly two in five have no picture stored at all. The blade hides a handle in that case (user/index.blade.php:1690 requires both), which is why those tags never appeared. The tagged accounts do exist, so their current avatar is looked up instead and the handle shows either way. Returns one array per post, aligned to that post's `tags`, with an empty string where no avatar could be resolved.

**Exports:** `resolveTaggedAvatars`

### `backend/src/utils/worldReach.ts` (158 lines)

the part of an author the WORLD filter needs — all of it already on the user document

**Exports:** `reachPercent`, `currentLocks`, `forgetLocks`, `lockedPercent`, `postReachesCountry`, `ViewerPlace`, `ReachUser`, `Lock`

## `backend/src/validators/`

### `backend/src/validators/auth.schemas.ts` (84 lines)

Mirrors the Laravel registration validators: - fan/creator (RegisterController): name, email, password(min 8, confirmed), Choose_username_or_URL, terms, optional networks/referral/categories - business (BuisnessController): company fields

**Exports:** `registerFanSchema`, `registerFanFullSchema`, `registerCreatorSchema`, `registerBusinessSchema`, `registerSchema`, `loginSchema`, `RegisterInput`, `LoginInput`

## `frontend/src/`

### `frontend/src/App.tsx` (229 lines)

/user and /influencer are Laravel's "my wall" routes: they render the viewer's own profile *at that URL* rather than redirecting to /{username}, so the address bar matches the original app.

### `frontend/src/index.css` (105 lines)

_(no leading comment found — read the file directly)_

### `frontend/src/main.tsx` (13 lines)

_(no leading comment found — read the file directly)_

## `frontend/src/api/`

### `frontend/src/api/auth.ts` (54 lines)

**Exports:** `login`, `register`, `fetchMe`, `logout`, `LoginInput`, `RegisterInput`

### `frontend/src/api/client.ts` (114 lines)

API client for the Superfans backend. In dev, Vite proxies /api → http://localhost:5000 (see vite.config.ts). Auth uses httpOnly cookies, so every request carries credentials.

**Exports:** `api`, `ApiEnvelope`

### `frontend/src/api/profiles.ts` (128 lines)

the blade's `hasPaidInfluencer` — this viewer bought priority access to the inbox

**Exports:** `fetchProfile`, `fetchProfilePosts`, `fetchFeed`, `fetchSubscribers`, `NetworkDetail`, `ProfileData`, `ProfilePost`, `FeedPost`, `SubscriberRow`

### `frontend/src/api/stories.ts` (105 lines)

The client's cap on story video, kept in step with STORY_MAX_VIDEO_SECONDS on the server. */

**Exports:** `fetchStoryStrip`, `fetchUserStories`, `uploadStory`, `deleteStory`, `markStorySeen`, `readVideoDuration`, `STORY_MAX_VIDEO_SECONDS`, `STORY_IMAGE_SECONDS`, `StoryElement`, `StoryOwner`, `Story`, `StripEntry`

## `frontend/src/components/`

### `frontend/src/components/AdCard.tsx` (482 lines)

One Super Ads tile, as it appears on the World feed and the walls. It lived inside World.tsx until the client asked for a page that shows every ad in the system; both draw the same tile, so it moved here rather than being copied. The World feed's own card markup around it is unchanged. Beneath the creative sits the advertiser's call to action. The button the client drew is new — it is in neither the Laravel original nor the earlier MERN — so what each one does is set out in ACTIONS below rather than guessed at the call site.

**Exports:** `adAction`, `resolveAdAction`, `isPaidAdvertiser`, `AdCard`, `CtaMark`, `AD_BUTTON_SIZES`, `AD_BUTTON_POSITIONS`, `AD_ACTION_LABEL`, `AdCardItem`, `AdButtonSize`, `AdButtonPosition`, `AdAction`, `AdCardVariant`

### `frontend/src/components/ConfirmDialog.tsx` (94 lines)

The classic-SweetAlert `dangerMode` confirm the influencer layout's trash icon raises — `layouts_influencer/footer.blade.php`'s global `.delete` click handler, `type="post"` branch: `swal({ title: 'Are you sure?', text: "You won't be able to revert this!", buttons: { defeat: 'Yes, delete it!', cancel: 'Cancel' }, dangerMode: true })`. That library (unpkg "sweetalert", not SweetAlert2) is not a dependency here either, so — same reasoning as SwalResult — this stands in for it: same purple/white shell, plus the two-button row `dangerMode` adds. The MERN post list deleted immediately on the bin icon with no confirmation at all; the client caught it missing this dialog first.

**Exports:** `ConfirmDialog`

### `frontend/src/components/MobileFooterMenu.tsx` (148 lines)

Mobile bottom bar — exact port of .mobile-footer-menu from layouts_direct_user/footer.blade.php: search input, 🌎 World, 🏆 Rankings, + add-post (guests → login), Stream, ✉️ messages. Styling comes from the extracted footer-modals.css (shown ≤ its media query).

**Exports:** `MobileFooterMenu`

### `frontend/src/components/NavToggle.tsx` (211 lines)

Mobile/tablet sidebar toggle — exact port of burgerMenu + mobileMenuOutsideClick from public/assets/js/main.js: click → toggles `offcanvas` on <body> and `active` on the toggle itself click outside #fh5co-aside / the toggle → closes it The slide-in/out animation itself comes from the original style.css (body.offcanvas #fh5co-aside { translateX(0) } etc.). /

**Exports:** `closeOffcanvas`, `NavToggle`

### `frontend/src/components/NetworkSlider.tsx` (71 lines)

already-resolved image URL — the client's SVG, or a legacy asset path

**Exports:** `NetworkSlider`, `NetworkSlide`

### `frontend/src/components/PageLoader.tsx` (57 lines)

Full-screen white loader with the locale Superworld logo — exact port of #loader from layouts_direct_user/header.blade.php: shown immediately, then `opacity 2.6s ease` to 0 and display:none after 10ms of window 'load'. Measured on Laravel: img width 59% (805px @1366), z-index 9999999.

**Exports:** `PageLoader`

### `frontend/src/components/PhoneField.tsx` (116 lines)

The phone field with a country picker beside it — the one control every form that asks for a number should use. The blades do this with intl-tel-input, the same 18.2.0 they pull from cdnjs, and always with the same two options: the dial code shown apart from the input, and the client's own eight preferred countries at the top of the list (auth/register_i.blade.php:695, auth/business_register.blade.php:813, ads/index.blade.php:999). They then read `iti.getNumber()` into a hidden field on every input/change/countrychange and submit that. This carries the same behaviour: the visible input holds what the user types, and `onChange` hands the caller the full international number, which is what the API stores. /

**Exports:** `PhoneField`

### `frontend/src/components/PostHeading.tsx` (105 lines)

The grey strip above a post: its author's handle, then anyone tagged in it. The world feed and the profile grids all render this, so it lives in one place — a second copy is how the wall ended up scrolling every handle, including the short ones that already fit.

**Exports:** `PostHeading`, `HeadingHandle`

### `frontend/src/components/PostReportButton.tsx` (165 lines)

The five report reasons from the Laravel post-report dropdown (feed / post_detail). The value sent to the API stays the blade's English string; the label shown is the full sentence from report.json, in the viewer's language.

**Exports:** `PostReportButton`

### `frontend/src/components/PremiumFanModal.tsx` (142 lines)

"Premium fan" — the two SweetAlerts the blade raises when a creator has their chat switched off and a fan writes anyway (user_profile.blade.php:1311-1345). Step one is the creator's own picture as the icon, `@name Super Busy!`, the queue message and one yellow BE PREMIUM FAN. Step two is the price: "Priority Access – $10", the explanation, and PAY $10, which in the blade posts amount=10 / payment_type=one_time to Redsys. This app is on Stripe, so the same charge goes through /payments/premium/:id. Every word and colour is the blade's own — the copy from lang/en/content.php:141-149, the yellow #FFEB3B / #e1be24 / #6A1B9A off the button's style attribute, and the green PAY button's #409c40 border and monospace face off its own. The purple ground and the popup geometry are shared with the chat dialog, both being SweetAlerts on the same page.

**Exports:** `PremiumFanModal`

### `frontend/src/components/RatingPill.tsx` (139 lines)

The wall's ❤️ · %Liked/Hated · 💩 group — the markup that sits commented out in world.blade.php:1318 and user/world.blade.php:2412, brought back because the client asked for it on the walls. Horizontal here; the full-screen viewer keeps its own vertical rail. Purely presentational: the card owns the like/hate state so the view counter beside it stays in step with the same toggle.

**Exports:** `RatingPill`

### `frontend/src/components/RegisterModal.tsx` (598 lines)

Guest modal chain — exact port of footer.blade.php: #register_Modal (choice) → #register_influencer_Modal ("Como Influencer" form) → #register_fan_Modal ("Como Espectador" form) → #login_Modal (login form) All purple (#8a2be2), white inputs (.register_modal_input), back arrow returns to the choice view — no page navigation, just like the blade jQuery handlers. /

**Exports:** `useRegisterModal`, `RegisterModalProvider`

### `frontend/src/components/Select2Multi.tsx` (126 lines)

select2 multi-select lookalike — renders select2's own DOM structure so the real select2 CSS (loaded in index.html, same CDN version as the blade) styles it identically: white box, 1px #aaa border, 4px radius, tag chips with ×. The blade keeps the native <select multiple> hidden behind it; we do the same so form semantics stay intact.

**Exports:** `Select2Multi`

### `frontend/src/components/StandalonePage.tsx` (88 lines)

Some blades are standalone pages (rankings/index.blade.php, the auth pages): they do NOT include the layout stylesheets and instead load **Bootstrap 4 from the CDN** plus their own fonts. Our index.html loads the layout CSS globally (local bootstrap.css is Bootstrap 3.3.5 — it even sets `html { font-size: 10px }`), so a standalone page must swap them while it is mounted. Notes: - Disabling via `link.disabled = true` is unreliable when the sheet is still loading (Chrome keeps applying it), so we switch `media` to `not all`. - The extra sheets are inserted at the START of <head> so the page's own CSS (bundled after) still wins — exactly the order the blade has them in. /

**Exports:** `useStandalonePageStyles`, `useLayoutPageStyles`, `BOOTSTRAP4_CDN`, `BOOTSTRAP46_CDN`, `DATATABLES_BOOTSTRAP4_CSS`, `RANKINGS_FONTS`

### `frontend/src/components/StreamModal.tsx` (121 lines)

#streamingModalCenter — the Go-Live dialog. The blade keeps it in the layout footer, which is why every page can raise it: the sidebar's STREAMING entry and the phone bar's Stream button open the same one. It lived inside the world sidebar here, out of reach of the bar, so it moves out whole — same markup, same wording, same colours. A guest is told the creator is off air; a signed-in one gets the bio/tags form that opens a room and walks into /start-stream/:room. /

**Exports:** `StreamModal`

### `frontend/src/components/sw-ads-loader.css` (32 lines)

SW ADS loading screen — values taken from ads/sidebar.blade.php:5-17. The icon is revealed from its top edge downwards, then the sheet fades.

### `frontend/src/components/SwAdsLoader.tsx` (45 lines)

The SW ADS loading screen — port of the #loader block at the head of resources/views/ads/sidebar.blade.php. The blade holds it for 1.6s after load, then fades it over 0.8s, which gives the 1.4s top-to-bottom reveal of the icon room to finish. One component so the Super-Ads pages and the two business auth pages, which the client wants to load behind the same icon, cannot drift apart.

**Exports:** `SwAdsLoader`

### `frontend/src/components/SwalResult.tsx` (92 lines)

The app's confirmation dialog — SweetAlert2's shape as the Laravel layout renders it (`layouts_direct_user/main.blade.php:322-347`: purple ground, white text, 1.2rem). SweetAlert2 is not a dependency here, so this stands in for it everywhere. It lived in Profile.tsx until AddPostModal needed it too — and AddPostModal is imported by Profile, which would have made the two files import each other. /

**Exports:** `SwalResult`

### `frontend/src/components/VolumeButton.tsx` (42 lines)

The mute/unmute button that sits on every autoplay video (blade: <button class="volume-btn" onclick="toggleMute(...)">). `variant="grid"` uses the inline style from user_posts/user_profile (bottom 22/right 15, 21×20); `variant="world"` relies on the .volume-btn class from the extracted world-page.css (bottom 20/right 20, 25×25).

**Exports:** `VolumeButton`

## `frontend/src/components/stories/`

### `frontend/src/components/stories/AddStoryModal.tsx` (175 lines)

"Add Storie:" (mockup Pas 2) — the same red modal chrome as Agregar Publicación, with a file picker, the Camera entry and the purple button beneath. Edit carries the file into the editor of Pas 3; Publicació there is what finally uploads. Camera opens the phone's own camera in the same panel and hands its capture on the same path, so a snapshot and a picked file reach the editor identically.

**Exports:** `AddStoryModal`

### `frontend/src/components/stories/StoriesStrip.tsx` (224 lines)

The circle's diameter. It lives here rather than in the stylesheet because StoryRing sizes the picture through width/height attributes, which CSS custom properties cannot reach. */

**Exports:** `StoriesStrip`

### `frontend/src/components/stories/StoryCamera.tsx` (150 lines)

The Camera entry of Pas 2: the phone's own camera inside the red panel, with a shutter for a still and a record button for a clip. Recording stops itself at the client's minute so nothing that would be refused on upload can even be made here. The capture is handed back as a File, which is exactly what the file picker produces, so the editor downstream cannot tell the two apart. /

**Exports:** `StoryCamera`

### `frontend/src/components/stories/StoryEditor.tsx` (417 lines)

The mockup writes "Max.11" above the search box. */

**Exports:** `StoryEditor`

### `frontend/src/components/stories/StoryRing.tsx` (57 lines)

An avatar wearing the rainbow story ring (mockups Pas 5 and Pas 7). Rendering it without a ring is deliberate: the profile header shows the same picture whether or not there is a live story, so one component covers both and the page does not branch on it. /

**Exports:** `StoryRing`

### `frontend/src/components/stories/StoryViewer.tsx` (441 lines)

the same colour at reduced strength, for the part of a bar still to come

**Exports:** `StoryViewer`

### `frontend/src/components/stories/textStyle.ts` (25 lines)

How a chosen text colour paints the story's text box. The four bright colours are ink on the box's white field, the way the mockup draws them. The two neutrals at the top of the palette are the field itself: white gives a white box with black words, black a black box with white ones — the client's rule, and the only way white is legible at all, since white ink on the white field was invisible.

**Exports:** `storyTextStyle`, `isFieldColour`

## `frontend/src/context/`

### `frontend/src/context/AuthContext.tsx` (56 lines)

True while the initial /auth/me session check is running.

**Exports:** `AuthProvider`, `useAuth`, `AuthUser`, `UserRole`

## `frontend/src/data/`

### `frontend/src/data/countries.ts` (203 lines)

Every country, alphabetically — the one list behind every country dropdown in the app: the merchandising checkout it was taken from, and the Super Ads profile and location forms. GENERATED by scripts/extract-countries.mjs from merchandising/show.blade.php. /

**Exports:** `ALL_COUNTRIES`

### `frontend/src/data/geo.ts` (94 lines)

Countries and cities for the forms that ask where somebody is. Both come from `/api/geo` — every country in the world, and on picking one, that country's whole city list (the same shape Laravel got from countriesnow.space, served from our own dataset instead). The full set is 148k cities, so the city list is fetched per country rather than shipped in the bundle. Each answer is kept for the life of the tab: a form reopened, or the second of the two forms that use these, costs nothing. If the request fails the country dropdown falls back to the checked-in list, so the form still works when the API does not.

**Exports:** `useCountries`, `useCities`

## `frontend/src/i18n/`

### `frontend/src/i18n/index.ts` (44 lines)

→ src/i18n/locales/**). Namespaces mirror the // original files: auth, content, footer, nav, pagination, passwords, report, validation — // plus stories, which has no Laravel original because the feature is new. const modules = import.meta.glob<ResourceKey>('./locales/

**Exports:** `SUPPORTED_LOCALES`, `Locale`

## `frontend/src/pages/admin/`

### `frontend/src/pages/admin/AdManagement.tsx` (267 lines)

What each column orders by, the way DataTables reads the rendered cell.

**Exports:** `AdManagement`

### `frontend/src/pages/admin/AdminAssets.tsx` (120 lines)

Admin Assets — port of admin/assets + add_asset + edit_asset + watermark blades.

**Exports:** `AdminAssets`

### `frontend/src/pages/admin/AdminCoupons.tsx` (86 lines)

Admin Coupons — port of admin/coupons + add_coupon + edit_coupon blades.

**Exports:** `AdminCoupons`

### `frontend/src/pages/admin/AdminDashboard.tsx` (55 lines)

Admin dashboard — port of AdminController@index: Sales / Users / Subscriptions stat cards.

**Exports:** `AdminDashboard`

### `frontend/src/pages/admin/AdminGrowth.tsx` (87 lines)

Growth Engine console — port of influencer/all_users.blade.php (superuser tool): per-user automatic-growth start/stop at a gear level, plus a manual "process" tick (ports startAutomaticGrowth + processGrowth).

**Exports:** `AdminGrowth`

### `frontend/src/pages/admin/AdminModels.tsx` (86 lines)

Admin Merch Models — port of admin/models + add_model + edit_modal blades.

**Exports:** `AdminModels`

### `frontend/src/pages/admin/AdminOrders.tsx` (67 lines)

Admin Orders — port of admin/orders + view_order_details blades.

**Exports:** `AdminOrders`

### `frontend/src/pages/admin/AdminPackages.tsx` (81 lines)

Admin Packages — port of admin/packages + edit_package blades.

**Exports:** `AdminPackages`

### `frontend/src/pages/admin/AdminShell.tsx` (67 lines)

Shared AdminLTE-style chrome for the admin panel: dark topbar + left nav + content.

**Exports:** `AdminShell`, `AdminModal`

### `frontend/src/pages/admin/AdminUsers.tsx` (147 lines)

the blade prints earnings as a plain 2-decimal figure; the table follows it

**Exports:** `AdminUsers`

### `frontend/src/pages/admin/AllUserPosts.tsx` (351 lines)

the typed ❤️/💩 figure; null means the pill runs on the real votes alone

**Exports:** `AllUserPosts`

### `frontend/src/pages/admin/AllUsers.tsx` (592 lines)

The blade's dismissible alert strip (all_users.blade.php:33).

**Exports:** `AllUsers`

### `frontend/src/pages/admin/ReachLocks.tsx` (654 lines)

The two lockers the client asked for beside his user panel — no Laravel original. "Country Zone Post Locker": posts made in one place, shown in another, at a figure he sets. "User Individual Locker Country": one account's posts, shown in a place, at a figure he sets. Either may name a region (Catalunya) instead of a whole country; cities he withdrew. Same standalone Bootstrap 4 shell as all_users, and the same gate: the API answers only the owner, and anybody else sees the "Admin access only" strip that panel shows. The account is picked from a suggestion list rather than typed, the way the site's own influencer search works, so a rule can only ever name somebody who exists.

**Exports:** `ReachLocks`

## `frontend/src/pages/ads/`

### `frontend/src/pages/ads/AdLeadForm.tsx` (252 lines)

the advertiser, drawn at the head of every step

**Exports:** `AdLeadForm`

### `frontend/src/pages/ads/AdsCenter.tsx` (775 lines)

The three cards that promote an existing post rather than an upload (Ads Center 1-3).

**Exports:** `AdsCenter`

### `frontend/src/pages/ads/AdsInformation.tsx` (86 lines)

$X,XXX.XX — the number_format($n, 2) with a $ prefix used across information.blade.

**Exports:** `AdsInformation`

### `frontend/src/pages/ads/AdsPreview.tsx` (224 lines)

Every Super Ad in the system, on one wall. The World feed deals ads in among the posts a handful at a time, so there was no way to look at them — to see how each type actually appears, or which ones are missing artwork or a link. This is that page: the World's own grid and the World's own tile, with the posts left out. Nothing here is filtered on approved or running, because the point is to see everything that exists. /

**Exports:** `AdsPreview`

### `frontend/src/pages/ads/AdsSidebar.tsx` (119 lines)

Fixed left nav for the Super-Ads area — port of resources/views/ads/sidebar.blade.php.

**Exports:** `AdsSidebar`

### `frontend/src/pages/ads/AdsType.tsx` (344 lines)

The fields each type asks for, taken from the blade's own branches (resources/views/ads/type.blade.php): clients-form title + budget, messages title + link, instagram link, calls phone, whatsapp phone + message, website-visits link — every one of them but instagram also uploading a creative. The social types below (tiktok, twitch, amazon, spotify, youtube) have no branch in the blade at all, so its form offers them nothing and the ad cannot be built. Their fields are kept because the link has to come from somewhere; removing them would leave those five cards leading to a form that cannot produce an ad.

**Exports:** `AdsType`

### `frontend/src/pages/ads/AllAds.tsx` (134 lines)

Admin: Manage All Ads — port of ads/all-ads.blade.php with approve/reject + stop/play.

**Exports:** `AllAds`

### `frontend/src/pages/ads/CountryCityFields.tsx` (105 lines)

The country and city dropdowns, wherever Super Ads asks for a place. The city was a free-text box, so an advertiser could aim at a city that is not in the country they picked, or spell one two different ways ("Malaga" / "Málaga"). Both are lists now: every country in the world on the first, and on the second whatever cities that country holds, fetched from /api/geo when it is chosen — which also means the city box has nothing to offer until a country is chosen, so until then it is disabled and says so. They are two separate controls rather than one block because the two forms that use them lay their fields out differently — the ad modal side by side, the profile in a Bootstrap grid — and each should keep its own layout.

**Exports:** `CountrySelect`, `CitySelect`

### `frontend/src/pages/ads/DataTableShell.tsx` (151 lines)

Client-side DataTables chrome — the "Show [n] entries" + "Search:" header, a table body (rendered per-page via the render-prop), and the "Showing X to Y of Z entries" + Previous/Next footer. Mirrors the jQuery DataTables look used across the ads/admin blades.

**Exports:** `DataTableShell`

### `frontend/src/pages/ads/LocationPicker.tsx` (48 lines)

Target-audience location — port of the country/city picker in the ads modal. Kept to a single country + city (the Laravel version supports multiple via a pipe-joined hidden field); the backend stores the resulting country/city on the Ad. Both are lists now: the city offered is one of the chosen country's own, and until a country is chosen there is nothing to choose from, so the city box stays shut.

**Exports:** `LocationPicker`

### `frontend/src/pages/ads/MyAds.tsx` (137 lines)

My Ads — port of ads/my-ads.blade.php: a table of the advertiser's ads with pay/delete.

**Exports:** `MyAds`

### `frontend/src/pages/ads/PostPicker.tsx` (56 lines)

Post thumbnails for promote-post/messages/followers ads — port of loadUserPosts()/renderMorePosts().

**Exports:** `PostPicker`

### `frontend/src/pages/ads/PotentialClients.tsx` (95 lines)

Potential Clients — port of ads/potential_clients.blade.php (business-only lead list).

**Exports:** `PotentialClients`

## `frontend/src/pages/auth/`

### `frontend/src/pages/auth/auth.css` (961 lines)

Exact styles ported from resources/views/auth/login.blade.php and register.blade.php */

### `frontend/src/pages/auth/AuthShell.tsx` (162 lines)

Locale → logo mapping from the Blade templates (fallback: English).

**Exports:** `localeLogo`, `FlagLanguageDropdown`, `AuthShell`

### `frontend/src/pages/auth/BusinessLogin.tsx` (115 lines)

Pixel parity with resources/views/auth/business_login.blade.php (grey business button). */

**Exports:** `BusinessLogin`

### `frontend/src/pages/auth/BusinessRegister.tsx` (282 lines)

The blade's `Swal.fire('…')` — SweetAlert2 11.3.6, which the register pages load from a CDN. Its default popup is white with grey lettering and a single confirm button; the cross is SweetAlert2's own `showCloseButton`, which the client asked for here. /

**Exports:** `BusinessRegister`

### `frontend/src/pages/auth/CreatorConfirm.tsx` (67 lines)

Pixel parity with resources/views/auth/influencer_r.blade.php — the "are you sure you're a creator?" confirmation step (/creador/confirm).

**Exports:** `CreatorConfirm`

### `frontend/src/pages/auth/CropModal.tsx` (100 lines)

data URL of the picked image

**Exports:** `CropModal`, `PictureType`

### `frontend/src/pages/auth/ForgotPassword.tsx` (93 lines)

Pixel parity with resources/views/auth/passwords/email.blade.php (uses the "Superfans Titulo" logo and an en/es-only language dropdown, as the original).

**Exports:** `ForgotPassword`

### `frontend/src/pages/auth/Login.tsx` (115 lines)

Pixel parity with resources/views/auth/login.blade.php

**Exports:** `Login`

### `frontend/src/pages/auth/Logout.tsx` (32 lines)

/logout — port of HomeController@logout (+ BuisnessController@logout): clears the session and redirects to /login, or /business/login for business accounts. Rendered as a route because the blade links to it with a plain <a>.

**Exports:** `Logout`

### `frontend/src/pages/auth/Register.tsx` (51 lines)

Pixel parity with resources/views/auth/register.blade.php — the account-type chooser (Creator → /creador, Fan → /fan).

**Exports:** `Register`

### `frontend/src/pages/auth/RegisterCreator.tsx` (7 lines)

/creador — pixel parity with resources/views/auth/register_i.blade.php

**Exports:** `RegisterCreator`

### `frontend/src/pages/auth/RegisterFan.tsx` (7 lines)

/fan — pixel parity with resources/views/auth/register_u.blade.php

**Exports:** `RegisterFan`

### `frontend/src/pages/auth/RegisterForm.tsx` (529 lines)

readAndValidateImage is a plain helper, not a component, so it cannot hold a hook: it reads the same bundle through the instance instead. */

**Exports:** `CustomFile`, `readAndValidateImage`, `RegisterForm`

### `frontend/src/pages/auth/ResetPassword.tsx` (120 lines)

Pixel parity with resources/views/auth/passwords/reset.blade.php

**Exports:** `ResetPassword`

## `frontend/src/pages/chat/`

### `frontend/src/pages/chat/Messages.tsx` (392 lines)

Chat — port of influencer/messages.blade.php (a full-screen WhatsApp-style page used by both fans and creators). Left: the people you've chatted with + a Busy/ON toggle for creators. Right: the open conversation (green bubbles for you, white for them) or a placeholder. New messages arrive in real time over Socket.io (the approved upgrade). /

**Exports:** `Messages`

## `frontend/src/pages/errors/`

### `frontend/src/pages/errors/error-page.css` (85 lines)

Standalone error screen. Self-contained on purpose: these pages render when something has gone wrong, so they must not depend on a page stylesheet that may itself have failed to load. Values mirror the site's own controls — the red outline button is the same .btn-primary.btn-outline used on profiles.

### `frontend/src/pages/errors/ErrorPage.tsx` (97 lines)

The error screens from resources/views/errors/*.blade.php — same logo, same wording, same "Volver" control. The blades link error_pages/css/*, a directory that does not exist in the Laravel public folder, so those pages render in the browser's default serif with a bare blue link. The content is reproduced as-is; the styling is the app's own (Roboto/Montserrat, the red outline button used across the site), which is what the client asked for.

**Exports:** `ErrorPage`, `NotFoundPage`, `PageExpiredPage`, `AdNotAvailablePage`

## `frontend/src/pages/merch/`

### `frontend/src/pages/merch/Merchandising.tsx` (187 lines)

blade parity: the category is derived from the product name, and the socks test looks for 'suck' — a typo in the original, so SuperSocks gets no category and the 🧦 anchor has no target. Kept as-is; fixing it would change the live behaviour.

**Exports:** `Merchandising`, `MerchProduct`

### `frontend/src/pages/merch/MerchandisingShow.tsx` (368 lines)

Product page — port of merchandising/show.blade.php. Shows the product (with an image carousel when it has extra images), the price, and the shipping form with the referring-creator autocomplete. Checkout itself goes through Redsys in Laravel; that gateway is a later milestone, so submitting reports that payments are not configured yet rather than pretending.

**Exports:** `MerchandisingShow`

## `frontend/src/pages/news/`

### `frontend/src/pages/news/News.tsx` (186 lines)

News management — port of influencer/news.blade.php (a standalone Bootstrap 4 page: a toggleable "Add News" form above a table of all news with edit/delete).

**Exports:** `News`, `NewsItem`

### `frontend/src/pages/news/NewsEdit.tsx` (97 lines)

Edit News — port of influencer/newsedit.blade.php.

**Exports:** `NewsEdit`

## `frontend/src/pages/profile/`

### `frontend/src/pages/profile/AddPostHost.tsx` (31 lines)

Opens #add_post_modal from the layouts.main pages (world, feed, influencers), which carry the same modal as the wall but have no posts of their own to hand it — the blade's controller loads them with the page. Fetched on demand here, the same way ControlPanelHost fetches the profile.

**Exports:** `AddPostHost`

### `frontend/src/pages/profile/AddPostModal.tsx` (505 lines)

called after any change (post added/deleted/visibility) so the page refetches

**Exports:** `AddPostModal`

### `frontend/src/pages/profile/ChatWithModal.tsx` (178 lines)

The date over each message, as the blade writes it: `${timestamp.getDate()} ${timestamp.toLocaleString('default', { month: 'long' })}` — the day, a space, and the month's full name in the browser's own language, which is why the client's screenshot reads "16 Abril" on a Spanish machine and "16 April" here.

**Exports:** `ChatWithModal`

### `frontend/src/pages/profile/ControlPanelCropModal.tsx` (159 lines)

Wires a control-panel file input to the cropper: selecting a profile/cover image opens the crop modal (after the blade's 250×250 minimum check); cropping uploads the 1095×1080 result and saves it. Shared by every control-panel modal so the behaviour cannot drift. /

**Exports:** `useCropUpload`, `ControlPanelCropModal`

### `frontend/src/pages/profile/ControlPanelHost.tsx` (42 lines)

Opens the viewer's own control panel from the layouts.main pages (world, influencers, feed): it fetches the profile on demand, then renders the creator modal or the fuller fan modal (#userModalCenter, with cover-colour/gender/birth/country/verified), which is the one Laravel shows on those pages.

**Exports:** `ControlPanelHost`

### `frontend/src/pages/profile/ControlPanelModal.tsx` (895 lines)

Control panel — port of #exampleModalCenter (the `Auth::user()->role != "influencer"` branch of layouts_direct_user/footer.blade.php). The blade posts one <form> per field to its own route; here each row calls PATCH /api/me/settings with just that field, keeping the same rules (bio ≤ 290 with live counter, unique username, "become creator" needs 10k followers and only shows above 0 followers). /

**Exports:** `RelationTile`, `fileToDataUrl`, `ControlPanelModal`, `H3`, `SAVE_BTN`, `FILE_INPUT`, `FILE_SAVE_BTN`, `HR`, `SELECT_STYLE`, `SocialNetworkOption`, `RelationRow`

### `frontend/src/pages/profile/InfluencerControlPanelModal.tsx` (997 lines)

Creator control panel — port of #exampleModalCenter's `@else` branch (layouts_direct_user/footer.blade.php L3532-4560), i.e. the modal an influencer sees. It differs from the fan one by adding the posts uploader, subscription price, earnings, bank/PayPal payouts and the Super Ads / SuperCalls links, and by dropping "become a creator". Note the blade's ordering quirk: the profile-picture border and footer credits sit *under* the NETWORKS heading here, unlike in the fan modal.

**Exports:** `InfluencerControlPanelModal`

### `frontend/src/pages/profile/PostDetail.tsx` (290 lines)

Post detail —Â port of post_detail.blade.php (/post/:id). Owner/subscriber sees the media + Like button; everyone else the locked tile with the Subscribe/Follow CTA. Prev | grid | Next pagination below.

**Exports:** `PostDetail`

### `frontend/src/pages/profile/PostFullscreen.tsx` (1050 lines)

The viewer's own click, kept in the browser beside the server's record of it — the client's "mini-cookies for FULL SCREEN saving the clicked animation (not hard restart bar)". The server is still what a vote *is*; this only holds the answer steady in the moment before it replies, and across a reload, so the bar is never handed back at rest after the viewer has already moved it. Only the two flags are kept — the counts belong to everyone, and this is one viewer's browser. Two hundred posts is far more than a session walks through, and the oldest fall off the end so the entry can never grow without limit.

**Exports:** `PostFullscreen`

### `frontend/src/pages/profile/Posts.tsx` (288 lines)

"Super Ads" tile injected after every 21st post (user_posts.blade.php).

**Exports:** `Posts`

### `frontend/src/pages/profile/Profile.tsx` (1475 lines)

Bio with newlines → line breaks (nl2br) and @mentions linked, as the Blade page does.

**Exports:** `Bio`, `PostItem`, `Profile`, `FollowButtons`, `EarnSection`, `ProfilePageFooter`, `SwalResult`

### `frontend/src/pages/profile/ProfileSidebar.tsx` (810 lines)

Influencer search with suggestions — mirrors the blade's bootstrap-typeahead on `.influencer_search` (verified first, badge in the list, navigate on pick).

**Exports:** `InfluencerSearch`, `GuestHeader`, `FooterLanguageSelector`, `LoggedInNav`, `ProfileSidebar`

### `frontend/src/pages/profile/SubscribeModal.tsx` (155 lines)

Subscribe confirmation modal — port of #paymentModalCenter (user_profile.blade.php L1071). Purple dialog with the superman icon + "✨ Subscribe to @username:", the "Relax! …single-use" message, a card-safety line, a Terms checkbox and the green ✨Subscribe button. Confirming (with terms checked) starts the payment redirect. /

**Exports:** `SubscribeModal`

### `frontend/src/pages/profile/SubscriberListModal.tsx` (135 lines)

Subscriber / follower list — port of #subcriberlistmodal (footer.blade.php L1926): a red dialog with the superman icon + "Followers" title and one white card per subscriber/follower (avatar + @username, plus a trash icon for the profile owner to remove them).

**Exports:** `SubscriberListModal`

### `frontend/src/pages/profile/UserModalCenter.tsx` (777 lines)

Fan control panel — port of `#userModalCenter` in **layouts/footer.blade.php** (the modal the `/user`-family pages render, which extend `layouts.main`). It is a different, fuller modal than the one on the profile page (`layouts_direct_user`): it adds a cover-colour select, gender/birth/country, the Super Ads link and the Redsys "request verified account" block, and drops bank/PayPal/Instagram.

**Exports:** `UserModalCenter`

## `frontend/src/pages/rankings/`

### `frontend/src/pages/rankings/Rankings.tsx` (312 lines)

Port of the blade's formatFollowers(): 0 | 1.2K | 3.4M | 1.1B (PHP round).

**Exports:** `Rankings`

## `frontend/src/pages/stories/`

### `frontend/src/pages/stories/StoryPage.tsx` (21 lines)

The address "Share url Storie" hands out: /stories/{handle}. Closing it steps back where there is something to step back to, and otherwise lands on that creator's profile rather than a blank screen — the same rule the post viewer follows.

**Exports:** `StoryPage`

## `frontend/src/pages/stream/`

### `frontend/src/pages/stream/StartStream.tsx` (248 lines)

Live-stream broadcaster — port of streaming/start-stream.blade.php. Loads the room (bio/tags/owner), connects to LiveKit, publishes the local camera + mic, and shows a live viewer count. If the stream cannot start it opens the "server pack" boost modal, whose four plans go through the shared payment engine (Stripe now, swappable later).

**Exports:** `StartStream`

### `frontend/src/pages/stream/WatchLive.tsx` (104 lines)

Live stream viewer — port of watch-live.blade.php. A standalone black page (it loads none of the layout CSS), joining a LiveKit room named by ?room= as ?user=, and listing the participants.

**Exports:** `WatchLive`

## `frontend/src/pages/world/`

### `frontend/src/pages/world/Influencers.tsx` (86 lines)

All-influencers grid — port of user/influencers.blade.php: one bordered card per creator (92×92 round avatar or coverYellow fallback + name), linking to the profile.

**Exports:** `Influencers`

### `frontend/src/pages/world/UserFeed.tsx` (375 lines)

Feed — port of user/feed.blade.php. A centred header (avatar · name · @user · Subscribe · "My Feed / Superfans World") followed by a grid of cards for every post from the people the viewer subscribes to and follows. Each card shows the author heading (@username + avatar + verified), the media in a rounded "phone" frame, a hover report control and a 👁️ view count. /

**Exports:** `UserFeed`

### `frontend/src/pages/world/World.tsx` (864 lines)

The hardcoded network slider of world.blade.php (11 items, per-item icon styles)

**Exports:** `WorldSidebar`, `World`

## `frontend/src/styles/`

### `frontend/src/styles/ad-card.css` (425 lines)

The call to action on an ad's creative, and the type tag the preview page adds. Every value here was measured off the client's own cards in /ads-images, pixel by pixel: the button sits on the lower part of the picture, square-cornered, with a heavy border in a second shade of its own colour. The six are not one button in six labels — each carries its own pair of colours, and that is what tells them apart at a glance. measured (creative 415px wide in every card) ──────────────────────────────────────────────────────────────────────────── border fill lettering button (of the 415px creative) More details #6d0acd #5558e0 white 228 x 67 = 54.9%, h/w 29.4% Call #36b823 #73e553 black 229 x 67 = 55.2%, h/w 29.3% Send Card #36b823 #73e553 black 229 x 67 = 55.2%, h/w 29.3% Subscribe #12d146 #c3ff0d black 178 x 54 = 42.9%, h/w 30.3% Follow #12d146 #c3ff0d black 178 x 54 = 42.9%, h/w 30.3% Whatsapp #4b4c52 #b3b3b3 black 194 x 56 = 46.7%, h/w 28.9% Border measures 6-7px on every one of them. Every size is therefore held as a share of the creative rather than in fixed pixels: the card is 415px in the mockup and about 330 on our desktop wall and half that on a phone, and the button has to read the same on all three. `cqw` is one per cent of the creative's width, so the numbers below are the mockup's own measurements divided by 415.

### `frontend/src/styles/add-post-modal.css` (130 lines)

===== Room around the add-post dialog ===== The dialog carried `margin: 30px auto` with a 600px cap. On a phone the cap is wider than the screen, so the box filled it end to end and the auto margins collapsed to nothing — the client's "no margin between screen and modal". Bootstrap's own rule is what the blade renders: 10px all round below 768px, 30px auto above it. Measured on Laravel at 390px: left 10, right 10, top 10, box 370 wide.

### `frontend/src/styles/add-story-modal.css` (139 lines)

"Add Storie:" — mockup Pas 2 (SelectFile.Camera.png), measured off the image. The mockup's red panel is 341px wide and 730 tall; every number below is that panel's own pixel measurement. Vertical rhythm, as measured (panel-relative): close 27 · hero 55 · title 113 · "Select File:" 253 · input 293 · rule 390 · camera 465 · label 498 · button 634 · panel foot 730. The gaps stay in absolute pixels rather than scaling with the panel: the type does not scale either, and stretching the spacing around fixed-size text only pulls the two out of step. A wider phone therefore gets the same modal with a little more air at the sides, which is how the rest of the app behaves. */

### `frontend/src/styles/chat-with-modal.css` (235 lines)

"Chat with @name" — the dialog the profile's ✉️ raises. The blade opens it as a SweetAlert (user_profile.blade.php:1461-1497) and SweetAlert2 is not a dependency here, so the box is drawn by hand. Every number below was read off the client's own running screen rather than guessed at: the modal was measured pixel by pixel from the screenshot he supplied, scaled by its 600px width (678px in the image, so 1.13), and the colours sampled from it. Note this is NOT the dialog in our read-only Laravel copy at ../superfans — that one still carries a "Chat with @name" heading, a hairline grey input and no rule under the button. The client's live site has moved on from it, and his screen is what these values follow. Where a value survives from the older blade it is marked as such.

### `frontend/src/styles/confirm-dialog.css` (34 lines)

ConfirmDialog's two buttons, colour- and hover-matched to the classic-sweetalert `dangerMode` override that skins them in Laravel (layouts_influencer/main.blade.php:611-634 — `.swal-button--defeat` is "Yes, delete it!", `.swal-button--cancel` is "Cancel"): square corners, and each swaps to a solid colour on hover over a 0.3s transition rather than sitting flat. Inline styles can't express `:hover`, hence a real stylesheet here.

### `frontend/src/styles/footer-modals.css` (777 lines)

/* Extracted verbatim from layouts_direct_user/footer.blade.php <style> blocks */

### `frontend/src/styles/influencer-search.css` (87 lines)

The influencer suggestion list, so it looks the same wherever the search is used. It was drawn entirely by the sidebar's own page stylesheet — layout-direct-user.css, injected as a <link> by StandalonePage and therefore absent from the auth pages. The creator register form asks for the same list, so the values are restated here, measured off the rendered sidebar rather than read back out of the theme: list #fff, 1px solid rgba(0,0,0,.15), 4px, shadow 0 6px 12px rgba(0,0,0,.176) row flex, 3px 20px, #333, 12px Arial 300, left, nowrap, ellipsis hover #6622e5 with white text No !important: on the sidebar the page stylesheet still wins with the same numbers, so nothing there moves; on a page without it, these apply on their own. Width is deliberately not set. The sidebar pins its list to 180px because its input is 180px; the list is positioned left:0/right:0 on the input either way, so a wider field gets a list of its own width rather than a 180px stub under it.

### `frontend/src/styles/layout-direct-user.css` (1501 lines)

Extracted verbatim from resources/views/layouts_direct_user/main.blade.php <style> blocks */

### `frontend/src/styles/lead-form.css` (265 lines)

The clients-form formulary, drawn to the client's mockups (potential-mockups/7–10.jpeg). Every value here is sampled from those images: the card's violet #525be8, the white fields on it, the pale buttons with their grey shadow, and the green that carries the two actions that finish the job — Send info and Visit website.

### `frontend/src/styles/modal-animations.css` (79 lines)

One entrance for every dialog in the app. Modals here are built five different ways — Bootstrap's .modal/.modal-dialog, the Ads Center's own overlay, .swal-modal, .networkmodal, and a handful of hand-rolled fixed overlays. Rather than teach each one its own transition, the panel of every family gets the same keyframes: it drops in from above while the ground behind it fades up. These are animations, not transitions, so they play the moment the element is mounted — no open/closed class has to be toggled, which is what the hand-rolled modals never did. /

### `frontend/src/styles/nav-toggle.css` (84 lines)

The phone's way into the sidebar. The three-bar burger in the top-left corner is replaced by the tab the client drew: a rounded purple handle on the left edge, halfway down the screen, with a chevron that turns to point back once the panel is open. It is the same element the burger always was (.js-fh5co-nav-toggle), only dressed differently, so every behaviour hanging off it is untouched — the click, the click outside that closes, the finger-drag in NavToggle.tsx, and the translateX(270px) the original stylesheet gives it so the handle travels out with the panel. Two things have to be stated in both states: `top`, because body.offcanvas resets it to 0 for the corner burger and the tab does not live in the corner; and the padding, which the base rule sets to 20px for a burger that no longer exists here. /

### `frontend/src/styles/network-slider.css` (77 lines)

Sidebar social-network slider. The blade centred the label by prefixing it with two &nbsp; and nudged each logo with its own margin-top, so every network sat a few pixels off centre and jumped as you paged through them. A fixed, centred icon box holds every logo at the same size and position instead, and the item slides in from the side it was paged from.

### `frontend/src/styles/parity.css` (67 lines)

============================================================ Parity shims — rules the blades express as inline `!important` styles, which React style objects cannot represent. Values copied verbatim from the blade markup. ============================================================

### `frontend/src/styles/phone-field.css` (27 lines)

The plugin wraps the input in a .iti of its own, which defaults to shrink-to-fit. Every form here lays its fields out full width, so the wrapper has to carry that through or the field ends up narrower than the ones above and below it. */

### `frontend/src/styles/post-heading.css` (70 lines)

The @handle strip that heads a post. Extracted from world-page.css so the profile wall and the posts grid render the identical control rather than a second, drifting copy.

### `frontend/src/styles/posts-page.css` (130 lines)

Extracted verbatim from user_posts.blade.php <style> blocks */

### `frontend/src/styles/premium-fan-modal.css` (197 lines)

The premium fan dialogs. The blade raises these as SweetAlerts (user_profile.blade.php:1311-1345) under the overrides `layouts_direct_user/main.blade.php:322-347` — the purple ground, white text and 1.2rem. SweetAlert2 is not a dependency here; the app's own stand-in for it is SwalResult (pages/profile/Profile.tsx:71), and its measurements are what this file follows so every dialog in the app carries the same box, title and spacing. What stays the blade's own is only what its markup sets by hand: the 92px picture, the yellow BE PREMIUM FAN, and the Bootstrap green on PAY.

### `frontend/src/styles/profile-page.css` (161 lines)

Extracted verbatim from resources/views/user_profile.blade.php <style> blocks */

### `frontend/src/styles/rating-pill.css` (503 lines)

The wall's rating row: 👁️ views on the left, ❤️ · %Liked/Hated · 💩 on the right. Values come from the world blade's own style block (world.blade.php:96-140 / user/world.blade.php:255-310), where the group sits commented out. Everything is scoped under `.stats-wrapper.has-actions` for two reasons: it beats the bare `.rating-pill` / `.actions-group` rules already extracted into world-page.css on specificity, whatever order the bundler emits them in, and it carries the whole group to pages like the profile wall that never loaded world-page.css.

### `frontend/src/styles/report-menu.css` (29 lines)

Report-reasons dropdown. On a phone the reasons are full sentences, so the menu is tall — anchored to the little arrow it opened from, it ran off the bottom of the screen. Below 768px it is pinned to the top of the viewport instead, as the client asked, and scrolls internally if the language makes it taller still.

### `frontend/src/styles/stories.css` (446 lines)

Stories — the ring, the feed strip and the full-screen viewer (mockups Pas 5, 6, 7). No Laravel original exists for any of this; the zip in the repo root is the reference. */

### `frontend/src/styles/story-editor.css` (446 lines)

Story editor — mockups Pas 3 and Pas 4, measured off the images. The mockup panel is 340px wide; canvas-relative numbers below come from a 254x460 canvas. Panel-relative: canvas x29 y158 w254 h460 · side labels x294 w33 h34 at y158/205/251, 13px from the panel's right edge · Publicació x80 y637 w180 h36. Canvas-relative: tag search x102 y4 w146 h40 · link + text popups x42 y42 w206 h79 · accept x190 y126 w58 · link swatches y127 h28 at x42/74/105 · font grid 51x26 at x42/95, y127/157 · colour grid 18px at x148/168, y127/146/166 · handles 23x23 above the element. Colours, sampled: accept #30bf14 on #156b05 · field #ffffff edged #585858 · link chips #00a8f3 #0ed145 #ffffff · text colours #ffffff #000000 #ec1c24 #ffaec8 #fff200 #5e3af1. */

### `frontend/src/styles/world-page.css` (621 lines)

Extracted verbatim from world.blade.php <style> blocks */

## `frontend/src/types/`

### `frontend/src/types/intl-tel-input.d.ts` (32 lines)

intl-tel-input 18.2.0 ships no types of its own — the version is pinned to the one the Laravel app loads from cdnjs, so the country list and the markup are identical. Only the pieces PhoneField uses are declared. /

**Exports:** `Iti`, `ItiOptions`

### `frontend/src/types/jsx-marquee.d.ts` (21 lines)

The blades still use the legacy <marquee> element (rankings rows scroll long usernames with it). React renders it fine; TypeScript just needs the type.

## `frontend/src/utils/`

### `frontend/src/utils/businessAccess.ts` (56 lines)

A business account belongs in the Super Ads Center and nowhere else in the app. The client's rule: if such an account reaches a World page — by typing the address or by following an old link — it is sent straight to /super-ads. The one exception he named is a creator's public profile at /{username}, which anybody may read. The check is on the first segment. Every address the app itself owns is listed here, so a single segment that is NOT in the list can only be a vanity profile.

**Exports:** `businessMayOpen`

### `frontend/src/utils/clickSounds.ts` (53 lines)

The network slider's click sounds. Port of the inline script the blades ship next to every #slider_id (influencer/world.blade.php:1262). Both arrows carry .play-sound2 and share one counter: clicks play close.mp3 until the count reaches the current entry of `pattern`, which plays Home-run-bat.mp3 instead and moves to the next entry. With [4, 9] that reads as three clicks with the basic sound and the fourth with the bat, then eight and the ninth, then four again — the cadence the client describes. The <audio> elements are the blade's clickSound2 and clickSound4, and calling play() on one already playing is a no-op there too, so a burst of fast clicks makes a single sound in both apps.

**Exports:** `playSliderClickSound`

### `frontend/src/utils/feedMemory.ts` (64 lines)

Keeps a randomised feed still while the reader steps away from it. The world pool is reshuffled on every request (world.routes.ts:114, and the blade does the same with a fresh rand() seed), so coming back from a post dealt a different set of posts. Restoring the scroll offset then landed the reader beside something they had never seen. The client asked for the feed to stay exactly as it was on the way back, and to reshuffle only when the World link is clicked or the page is reloaded. The return leg is recognised by a mark left at the moment the reader leaves, not by the navigation type: react-router reports POP for a first render too, so a freshly opened URL is indistinguishable from a back step by that alone. A mark is only ever left by an in-app departure, and reading it consumes it, which leaves every other way of arriving -- typing the URL, clicking World, reloading -- to deal a new hand.

**Exports:** `markFeedReturn`, `rememberFeed`, `recallFeed`, `RememberedFeed`

### `frontend/src/utils/format.ts` (228 lines)

Exact port of the blade helper `thousandsCurrencyFormat($num)` (user_profile.blade.php ~3693) used for the profile stats: if ($num > 1000) { number_format → split on ',' → first group + '.' + first digit of the next group (dropped when 0) + ['k','m','b','t'][groups-1] } Note the LOWERCASE suffix and that it truncates (does not round) the decimal: 12,200,000 → "12.2m" · 2,200,000,000 → "2.2b" · 950 → "950".

**Exports:** `formatNumber`, `formatNumberRounded`, `isVideoFile`, `videoMime`, `assetImage`, `likePercent`, `likeLevel`, `likeFill`

### `frontend/src/utils/networkLogo.ts` (41 lines)

The client's SVG logo sets, keyed by network name. Two variants of the same artwork arrived from the client: - `scroll` — the plain logo, for the sidebar's social-network slider - `card` — the same logo on the #E4E4E4 grey card, for the tiles on a wall Names come from the socialnetworks collection (and the hardcoded world list), so they are matched loosely: case and punctuation are stripped before lookup. An unknown name returns null and the caller keeps whatever image it had.

**Exports:** `networkLogo`, `LOCKED_POST_IMAGE`, `NetworkLogoVariant`

### `frontend/src/utils/postLoginRedirect.ts` (13 lines)

Where to send someone straight after they authenticate. Port of LoginController::redirectTo(): business accounts go to the ads centre, creators to their creator wall, everyone else to their own wall. Sending them to "/" instead lands them on the logged-out world page.

**Exports:** `postLoginPath`

### `frontend/src/utils/postSounds.ts` (73 lines)

The like/hate sounds the walls play, ported from the blade's own handlers (user/world.blade.php:3552 and :3610): the coin on a like and the woosh on a hate, each played on the toggle's response and for both directions — liking and un-liking alike. The blade holds them in <audio id="clickSound3"> / <audio id="clickSound5">; one element per sound is enough here too, and play() on one already playing is a no-op in both apps, so a burst of fast clicks makes a single sound.

**Exports:** `playLikeSound`, `playHateSound`

### `frontend/src/utils/usePaymentReturn.ts` (79 lines)

what the page gets back: whether the money went through, and the line to show.

**Exports:** `usePaymentReturn`, `PaymentReturn`

### `frontend/src/utils/useRatingFeedback.ts` (28 lines)

The click feedback the blade fires from its toggle response: the coin plus a beating heart on a like, the woosh plus a bouncing poop on a hate — both ways round, liking and undoing it alike. The card calls onLiked/onHated once the request has answered, so nothing sounds when the toggle fails or a guest is sent to the register modal instead. /

**Exports:** `useRatingFeedback`

### `frontend/src/utils/useScrollMemory.ts` (83 lines)

Records where the page is scrolled to, for a grid that is about to open the full-screen viewer. Call this at the moment of navigation rather than leaving it to an unmount cleanup: the viewer is `position: fixed`, so the document collapses to one viewport as it mounts and the browser clamps scrollY to 0 — anything reading the position after that records the top of the page.

**Exports:** `rememberScroll`, `useScrollMemory`

### `frontend/src/utils/video.ts` (137 lines)

Autoplay-video system — exact port of the world.blade.php scripts: 1. IntersectionObserver (threshold 0.5) drives ALL play/pause — videos have no autoplay attribute: - Desktop (>991px): if a visible video is unmuted, only IT plays and every other video is paused+muted. Otherwise only the FIRST visible video plays, with `muted = isGlobalMuted` (so after unmuting once, the one playing video keeps sound as you scroll). No visible videos → all pause. - Mobile: each video entering view plays with the global mute state, leaving view pauses it. 2. toggleMute: desktop unmute → only that video has sound (all others muted+paused); mute → just mutes it. Mobile → global toggle. Persisted to localStorage('video_muted').

**Exports:** `observeNewVideos`, `toggleMute`

### `frontend/src/utils/worldSequence.ts` (64 lines)

The run of the World feed the full-screen viewer walks when it is opened from the wall. It carries the ads as well as the posts, and in the feed's own order — the client asked for the ads to appear in the full-screen scroll exactly as they do on the wall, which the server already arranges by dropping one in after every sixth post (world.routes.ts). The wall used to strip them out before handing the run over, so the viewer never saw one. A post is only its id: the viewer fetches the post itself anyway. An ad is carried whole, because nothing else will fetch it.

**Exports:** `isAdStep`, `isAdId`, `toSteps`, `readSteps`, `appendSteps`, `WorldStep`

