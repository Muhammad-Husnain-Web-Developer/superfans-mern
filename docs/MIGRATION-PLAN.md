# Superfans — MERN Migration Plan

> Approved decisions (2026-07-12): migrate existing MySQL data to MongoDB · chat upgraded
> to Socket.io (same UX) · growth engine + admin manual counts carried over as-is.
>
> **Correction (2026-07-22): payments were planned wrong.** The original plan said
> "Stripe first, PayPal/Redsys deferred". Reading the Laravel payment code shows the
> opposite: **creator subscriptions and merchandising checkout both run on Redsys**, and
> Stripe only handles the small VIP/Premium charge. Building Stripe first would have
> delivered a flow the client does not actually sell through. The milestones below now
> put Redsys first — see [Payment gateways](#payment-gateways-corrected).
>
> Reference: [ARCHITECTURE-ANALYSIS.md](ARCHITECTURE-ANALYSIS.md). The Laravel app at the
> repo root is read-only source of truth; all work happens in `/superfans-mern`.

---

## Architectural decisions

| Topic | Decision | Rationale |
|---|---|---|
| Backend language | **TypeScript** on Express 5 + Mongoose | Frontend is already TS; typed models prevent schema drift during migration |
| Auth | JWT in **httpOnly cookies** + refresh token | Mirrors Laravel session security (XSS-safe), works with SPA |
| Roles | Same four roles (`user`, `influencer`, `business`, `admin`) as a field on User; middleware mirrors Laravel's `admin/influencer/User/not_business` gates. Admin becomes a **formalized role** (Laravel's admin tools were scattered in the influencer area) | Cleaner, same behavior |
| API shape | Unified REST API with role checks (replaces Laravel's duplicated per-role controllers); JSON responses + toast notifications replace redirect+flash | Behavior parity, less duplication |
| Media storage | Storage service abstraction: `local` driver for dev, `cloudinary` driver for production images; video hosting decision deferred until usage data | Provider-swappable, no rewrite later |
| Legacy modules | Dropped: packages/carts/coupons/watermarks/modals/assets (empty tables), old chats/messages system, `-bak` controllers | Dead code |
| Realtime | Socket.io for chat + notifications; LiveKit stays for streaming | |
| Background jobs | `node-cron` for growth engine & recurring checks; BullMQ (Redis) only if video queue needs scale later | Keep infra light initially |
| i18n | i18next (frontend) with the 8 locale files converted from Laravel `resources/lang` | |
| Testing | Per-milestone: API tests (Vitest + Supertest) + manual UX parity check against the Laravel app side-by-side | Validation gate before next milestone |

## Data migration (MySQL → MongoDB)

A standalone script (`backend/scripts/migrate-mysql.ts`) reading from
`superfanslaravel` (or the dump) and writing MongoDB collections:

- `users` ← users (+ blocks, social networks embedded)
- `posts` ← posts (+ likes/hates/visits as separate collections for counts parity)
- `follows` ← followerships; `subscriptions` ← subscriptions + stripe_subscriptions
- `payments` ← payments; `chatMessages` ← chatbox; `products`/`purchases`; `ads`/`adCampaigns`/`leads`; `news`; `streamRooms`; `earningsLogs`
- Passwords: Laravel uses **bcrypt** — hashes migrate as-is and work with Node's `bcryptjs` (users keep their passwords)
- Media: DB stores filenames → migrated as keys resolvable by the storage service (existing `assets/images/...` URLs keep working)
- Script is **idempotent & re-runnable** (upserts by legacy `mysql_id` kept on every doc) so we can re-sync until cutover

## Milestones

Each milestone = build → test → demo → **your approval** → next.

| # | Milestone | Scope | Key parity checks |
|---|---|---|---|
| **M0** | Foundations | Backend: TS setup, folder structure, config/env, Mongo connection, error handling, logging, auth scaffolding. Frontend: React Router, API client, auth context, layout shell with existing fonts/colors (RockwellNova, icomoon), i18next with 8 locales | App boots, health endpoint, login page shell renders in all languages |
| **M1** | Auth & users | Register (fan/creator/business flows), login/logout, JWT cookies, password reset email, role middleware, **user data migration** | All 3 signup flows work; migrated users can log in with old passwords |
| **M2** | Profiles & media service | Storage abstraction (local driver), profile/cover upload + crop, profile pages, vanity URLs, bio/socials/cover color, blocking & reporting | Profile pages pixel-close to Laravel; old profile pictures resolve |
| **M3** | Posts & engagement | Image/video upload (FFmpeg thumbnails, HEIC), likes/hates/visits, visibility toggles, post detail with prev/next, **posts+likes migration** | Feed of migrated posts renders; like counts match MySQL |
| **M4** | World feed & rankings | 5-tier discovery algorithm (same thresholds 50k/5k/1k/500/1), per-creator caps, seeded shuffle + cache, pagination; gold/silver/bronze rankings | Tier distribution matches Laravel logs for same data |
| **M5** | Follows & **Redsys** subscriptions | Free follow (done); paid subscribe via Redsys redirect + stored-card (COF) recurring — the gateway the profile's subscribe modal actually posts to; unsubscribe, earnings & withdrawal requests; recurring charge cron with 15-day/monthly plans + 2-day retry | Sandbox subscription end-to-end; earnings ledger updates |
| **M6** | Chat (Socket.io) | Real-time DMs, conversation list, chat toggle, unread badges, **chatbox history migration** | Same UX as Laravel polling chat but instant |
| **M7** | Growth engine & admin | node-cron growth (same gear multipliers/intervals), admin panel: user management, suspend/delete, verify/VIP, manual follower/like counts, growth gear control | Growth numbers evolve like Laravel for same gear |
| **M8** | Merchandising & news | Product catalog **(done — 30 products, both pages 0-diff)**, Redsys checkout, purchase history; creator news CRUD | Product pages + checkout parity |
| **M9** | Ads Center | Business campaigns, ad types, lead-gen forms + public submit, approval workflow, impressions/clicks analytics, ad payment | Business account can create → pay → get approved → serve ad |
| **M10** | Live streaming | LiveKit room create, token endpoint **(done)**, broadcaster + viewer pages **(viewer done — 0-diff)** | Stream start/watch works with LiveKit cloud dev keys |
| **M11** | Stripe VIP + PayPal | The remaining gateways: Stripe one-off charge for VIP/Premium (`InfluencerPremium`); PayPal checkout (`/user/charge`) | Sandbox transactions on both |
| **M12** | Cutover readiness | Full data re-migration rehearsal, i18n completion pass, QA parity sweep of every route, production configs (Cloudinary driver, PM2/Docker), deployment guide | Side-by-side checklist of all 14 modules signed off |

## What I need from you (per milestone)

- **M0**: nothing — can start immediately
- **M5 / M8**: **Redsys test (sandbox) merchant code + secret key**, and `REDSYS_ENVIRONMENT=test`.
  The Laravel `.env` already holds Redsys credentials, but they are `production` — never
  develop against those.
- **M10**: LiveKit dev project (or reuse existing keys if that project is non-production)
- **M11**: Stripe **test** keys + PayPal sandbox (never the `sk_live` key in the Laravel `.env`)
- **M12**: Cloudinary account, production hosting decision

## Payment gateways (corrected)

Established by reading the Laravel payment code on 2026-07-22, after the original plan
assumed Stripe was the primary gateway:

| Flow | Gateway | Where it is wired |
|---|---|---|
| **Creator subscription** (the main revenue flow) | **Redsys** | Profile subscribe modal posts to `route('redsys.now')` → `RedsysTestController` (3 forms in `user_profile.blade.php`) |
| **Merchandising checkout** | **Redsys** | `merchandising/show.blade.php`: "processed securely through Redsys" |
| VIP / Premium (`InfluencerPremium`) | Stripe | `route('stripe.premium')` → `UserController@stripePostPremium`, a one-off `Charge` |
| `/user/charge` | PayPal (omnipay) | `UserController@charge` |

Notes for whoever picks this up:

- `composer.json` carries all three SDKs (`creagia/laravel-redsys`, `stripe/stripe-php`,
  `omnipay/paypal`), so package presence alone does **not** tell you which one is live.
  The Stripe *subscription* code in `UserController` (~L832) has no route pointing at it.
- Redsys is Spain's bank gateway — expected for this market.
- The Laravel `.env` contains **live** Redsys, Stripe (`sk_live`) and PayPal credentials.
  It is correctly git-ignored and was not pushed. Do not develop against it.

## Out of scope (unless requested)

- Redesign/UX changes beyond framework-forced ones (SPA navigation, toasts)
- The Laravel file-integrity monitor (`files:monitor`) — host-level concern; can be revisited at deployment
- Migrating the 1.5 GB of orphaned media files
