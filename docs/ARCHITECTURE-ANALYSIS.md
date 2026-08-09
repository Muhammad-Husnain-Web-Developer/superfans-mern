# Superfans — Existing Application Architecture Analysis

> Source-of-truth reference for the MERN migration. Analyzed from the Laravel codebase at the repo root
> (read-only — the original project is never modified). Date: 2026-07-10.

---

## 1. Technology stack (current)

| Layer | Technology |
|---|---|
| Backend framework | Laravel 8 (PHP ≥ 8.1) |
| Database | MySQL, schema `superfanslaravel` (46 tables) |
| Frontend | **Server-rendered Blade templates** + jQuery + Bootstrap 4 (no SPA; Vue 2 is installed in package.json but unused — `resources/js` is empty) |
| Asset pipeline | Laravel Mix 6 (webpack) → `public/css/app.css`, `public/js/app.js`; but most pages load hand-maintained CSS/JS from `public/assets/` |
| Sessions | File-based, cookie session auth (classic Laravel web guard, CSRF tokens) |
| Queue | `database` driver (jobs table); used for video processing and bulk email |
| Cron | Laravel scheduler: `growth:process` (every minute), `payments:process-recurring` (daily), `files:monitor` (hourly) |
| Mail | SMTP (sendmail driver), admin notifications + user emails |
| i18n | 8 locales: en, es, ca, fr, de, it, pt, cn — session-based locale switch (`/lang/{locale}`), `SetLocale` middleware |

### Third-party integrations

> Verified 2026-07-22 by tracing the blade forms to their routes. All three payment SDKs
> are installed, so package presence alone does not tell you which gateway is live — the
> subscribe modal in `user_profile.blade.php` posts to `route('redsys.now')`.

| Service | Library | Used for |
|---|---|---|
| **Redsys** (Spanish card gateway) | creagia/laravel-redsys | **The live payment path**: fan→creator subscriptions (stored-card COF recurring), merchandising purchases, ad payments |
| **Stripe** | stripe/stripe-php | VIP/Premium one-off charge (`stripePostPremium`) only. Stripe *subscription* code exists in `UserController` (~L832) but **no route reaches it** |
| **PayPal** | league/omnipay + omnipay/paypal | Alternate checkout (`/user/charge`, package purchases) |
| **LiveKit** | agence104/livekit-server-sdk | Live streaming (rooms + server-minted JWT access tokens) |
| **FFmpeg** | php-ffmpeg | Video post processing / thumbnails (`ProcessVideoJob`) |
| **HEIC→JPG** | maestroerror/php-heic-to-jpg | iPhone image upload conversion |
| **IP Geolocation** | stevebauman/location | `TrackCountry` middleware → `registered_country`, `visited_countries` on users |

---

## 2. Roles & access control

Single `users` table with a `role` column: **`user`** (fan), **`influencer`** (creator), **`business`** (advertiser), and **`admin`** (middleware checks `role == 'admin'`; note: current DB snapshot contains no admin-role rows — admin-type actions also live inside the influencer area; flagged as open question §7).

Middleware:
- `auth` — classic session auth
- `admin` / `influencer` / `User` — exact role gates (redirect `/` on failure)
- `not_business` — blocks business accounts from the social side
- `restrict_super_ads` — gates the Super Ads Center
- `TrackCountry` — geolocation logging on every request
- `SetLocale` — applies session locale

Three separate registration flows:
1. **Fan** (`/fan` → `RegisterController`) — username, profile/cover image (uploaded pre-registration via session-stored temp names), social networks, optional referral (`referred_influencer`).
2. **Creator** (`/creador` → same controller, `role=influencer`) — adds categories, referral by other influencer, confirm page.
3. **Business** (`/business/register`, `BuisnessController`) — company fields (dni, company_name, company_id, address); separate login/logout endpoints.

Vanity URLs: `Route::fallback()` resolves any unmatched path as a profile page by `username_URL`.

---

## 3. Functional modules

### 3.1 Profiles
- Profile picture, cover picture, cover color, bio, name/surname, birth/country/gender, footer text, profile-picture border status.
- Social network links (`Influencer_networks` CSV + `influencer_networks` table, Instagram link).
- Creator-specific: subscription price, bank account, PayPal account, VIP flag, verified flag, chat toggle.
- Users can request upgrade to creator (`request_creater_account` → instantly sets role=influencer).
- Blocking (`user_blocks`), reporting posts/users (email to admin).

### 3.2 Posts & engagement
- Posts: image or video (`image_video`), thumbnail, tags, tagged profile pictures, visibility flag, `no_of_likes`, `no_of_views`.
- Uploads to `public/assets/images`; videos processed by queued `ProcessVideoJob` (FFmpeg); HEIC converted.
- Likes (`likes`), "hates" (`hates`), post visits (`post_visits`), per-post and bulk visibility toggles, delete single/all.
- Post detail with prev/next navigation within a creator's posts.

### 3.3 World feed (discovery) — the core algorithm
`WorldController@world` (guest), plus role-specific variants in `UserController@world` / `InfluencerController@world`:
- Creators are bucketed into **5 mutually-exclusive tiers by lifetime likes** ("views"): T1 ≥ 50k, T2 ≥ 5k, T3 ≥ 1k, T4 ≥ 500, T5 ≥ 1.
- A pool of up to 300 recent posts (< 290 days old, visible, active users) is built with tier-weighted sampling and **per-user post caps** (prevents one creator flooding the feed), shuffled with a random seed, cached 5 minutes, paginated 15/page.
- Extensive logging (`WORLD FUNCTION STARTED`, tier counts, distribution).

### 3.4 Follows & paid subscriptions
- **Free follow**: `followerships` table.
- **Paid subscription** fan→creator: `subscriptions` table (`amount`, `plan` = `monthly` | `quinzenal` (15-day), `next_payment_at`).
- Payment paths, in the order they matter for the migration:
  - **Redsys — this is the one the UI uses.** The subscribe modal posts to
    `route('redsys.now')` → `RedsysTestController`, which creates the `subscriptions` row.
    Card stored as COF (`redsys_cards`); **daily cron `payments:process-recurring`** charges
    due subscriptions, advances `next_payment_at` (+15d or +1mo), retries in 2 days on
    failure; writes `payments` rows.
  - **PayPal** (Omnipay): redirect purchase → on return creates `subscriptions` row (`/user/charge`).
  - **Stripe**: code exists (Customer + dynamic `Price` + monthly Subscription, recorded in
    `stripe_subscriptions`, ~`UserController` L832) but **no route points at it** — legacy.
    The 1,934 `stripe_subscriptions` rows are history from when it was in use.
- `influencer_premium` — per-creator premium unlock (`stripePostPremium`).
- Unsubscribe / unfollow endpoints.
- Price-increase flow: queued job `SendEmailPriceIncreaseToSubscribers` + `NotifyUserPriceIncreaseMail`.

### 3.5 Earnings
- `earnings` on users, `earnings_logs`, `update_earnings`, `withdraw_earnings` (creator requests payout to bank/PayPal).

### 3.6 Chat (two generations)
- **Active system — "Chatbox"**: `chatbox` table (381 rows), REST polling API (`POST /api/chatbox/fetch`, `/send`, `/getChatUsers`). Simple sender/receiver messages, conversation list ordered by last message. No websockets (BROADCAST_DRIVER=log; Pusher keys empty).
- **Legacy system**: `chats`/`messages` tables + `ChatController` (empty tables — appears superseded).
- Creators can toggle chat availability (`chat_toggle`).

### 3.7 Live streaming (LiveKit)
- `POST /create-room` → creates `stream_rooms` row (bio, tags, room_name `room_<uniqid>`).
- `GET /streamtoken?room&user` → server mints LiveKit JWT (join+publish+subscribe).
- `/start-stream/{room}` broadcaster page; `/watch-live` viewer page.

### 3.8 Merchandising (e-commerce)
- `products` (244 rows) with slugs; `merchandising` index + product page; purchase via **Redsys** redirect; `product_purchases` recorded on callback/confirm.

### 3.9 Super Ads Center (business advertisers)
- Ad types (incl. Instagram-style preview), `ads` + `ad_campaigns` + `ad_campaign_details` (+ campaign days), targeting profile (`ad_user_profiles`).
- Lead-generation forms: `ad_formulary_forms` + `ad_formulary_leads` (public submit endpoint).
- Payment before activation via **Redsys** (`ad_payments`, session-based payment context, success/cancel routes).
- **Approval workflow**: admin approves/rejects ads (`approved` flags); "my ads", "potential clients", analytics (clicks increment endpoint, views).
- Emails on ad creation & payment to user + admin.

### 3.10 Rankings
- `/rankings` — gold/silver/bronze creator leaderboards (by followers/likes) with "load more" for bronze.

### 3.11 News
- Creator-scoped news CRUD (`news` table).

### 3.12 Admin capabilities (inside influencer area)
- List all users, suspend (`status`)/delete users, verify influencers, toggle VIP.
- **Manually set follower and like counts** per user/post.
- Approve/reject ads; view all ads.

### 3.13 Growth engine (synthetic engagement)
- `growth:process` runs **every minute** for users with `growth_status=active`:
  - Like growth per post: interval depends on post age (<48h: every minute; <13d: hourly; older: ~every 11h); base = 0.5% of followers × gear multiplier (gear 1–5 → 0.5×–3.5×) × random 0.8–1.2.
  - Follower growth every ~150 min: 0.5% of followers × gear multiplier (0.5×–3×).
- Started per-creator via "start automatic growth" (gear selection) in the UI.

### 3.14 File-integrity monitor
- `files:monitor` hourly — `FileChangeScanner` hashes files (`file_checksums`, 623 rows), emails `FileChangeAlert` on changes (tamper detection).

---

## 4. Database inventory (46 tables, key ones)

| Table | Rows | Purpose |
|---|---|---|
| users | 4,416 | All roles; ~70 columns (profile, payment, growth, geo) |
| posts | 2,420 | Creator/user posts |
| likes / hates / post_visits | 1,899 / 16 / 53 | Engagement |
| followerships | 91 | Free follows |
| subscriptions | 1,179 | Paid subs (plan, next_payment_at) |
| stripe_subscriptions | 1,934 | Stripe sub references |
| payments | 59 | Payment log (method: stripe/paypal/redsys) |
| redsys_cards / redsys_requests / redsys_notification_logs | 27 / 1,609 / 1,879 | Redsys package tables |
| influencer_premium | 3 | Premium unlocks |
| earnings_logs | 3 | Payout/earnings history |
| chatbox | 381 | Active chat messages |
| chats / messages | 0 / 0 | Legacy chat (unused) |
| stream_rooms | 57 | LiveKit rooms |
| products / product_purchases | 244 / 53 | Merch |
| ads / ad_campaigns / ad_campaign_details | 98 / 62 / 260 | Ads Center |
| ad_user_profiles / ad_formulary_forms / ad_formulary_leads / ad_payments | 14 / 0 / 0 / 0 | Ads targeting, lead-gen, payments |
| news | 2 | Creator news |
| user_blocks | 3 | Blocking |
| file_checksums | 623 | Integrity monitor |
| socialnetworks / influencer_networks | 12 / 2 | Social links |
| packages, package_includes, carts, cart_details, coupons, coupon_usages, modals, assets, water_marks | 0 | **Legacy/unused** (empty) |

---

## 5. Frontend behavior (what must be reproduced)

- Layouts: `layouts/main` (guest), `layouts_direct_user`, `layouts_influencer`, `layouts_admin` — same visual shell (icomoon icons, RockwellNova fonts, Bootstrap 4, owl-carousel, animate.css, custom `style.css`).
- Interaction style: forms POST → redirect back with flash messages (SweetAlert); jQuery AJAX for likes, chat polling, autocomplete search (influencer/user), infinite "load more", image crop/upload (Cropper.js, Dropzone), Select2 inputs.
- Registration is multi-step client-side with pre-upload of profile/cover images and live email/username duplicate checks.
- Chat UIs poll the chatbox API on an interval.
- Streaming pages use the LiveKit JS client from CDN.

---

## 6. Proposed MERN mapping (for discussion — not yet implemented)

- **Frontend**: React 19 + Vite + Tailwind (already scaffolded) — SPA with React Router; server flash-message pattern replaced by API responses + toasts; jQuery plugins replaced by React equivalents (carousel, cropper, select, modals).
- **Backend**: Express 5 (scaffolded) + Mongoose; JWT (httpOnly cookie) auth to mirror session behavior; role middleware mirroring `admin/influencer/User/not_business`.
- **MongoDB collections** mirroring the active tables (users, posts, likes, follows, subscriptions, payments, chatMessages, streamRooms, products, purchases, ads, adCampaigns, leads, news, blocks, earningsLogs); empty legacy tables intentionally dropped.
- **Cron** → node-cron/BullMQ jobs for growth engine, recurring payments, file monitor.
- **Media** → multer + fluent-ffmpeg + sharp (HEIC).
- **Integrations** → Redsys via `redsys-easy` (**the primary gateway — validate this library
  early**), LiveKit server-sdk-js, then stripe (official Node SDK) and
  @paypal/checkout-server-sdk for the VIP and package flows, geoip for country tracking.
- **i18n** → i18next with the 8 existing locale files converted.

## 7. Open questions (need product decisions before planning)

1. **Admin**: middleware expects `role='admin'` but no admin users exist in this DB snapshot; admin tools live in the influencer area. Who is the real admin and should MERN keep this arrangement or formalize an admin role?
2. **Legacy modules** (packages/carts/coupons/watermarks/modals/assets tables — all empty; old chat tables): migrate or drop?
3. **Data migration**: does the MERN version need the existing MySQL data imported into MongoDB (4.4k users, 2.4k posts), or start fresh?
4. **Payments**: keep all three gateways (Stripe + PayPal + Redsys incl. stored-card recurring), or consolidate? Redsys COF recurring is the most complex piece.
5. **Growth engine** (synthetic likes/followers): confirm it must be carried over as-is.
6. **Chat**: keep polling, or upgrade to websockets (Socket.io) while preserving UX?
7. **Duplicated role-specific controllers** (User/Influencer variants of the same pages): MERN can unify these behind one API with role checks — confirm that's acceptable as long as behavior matches.
