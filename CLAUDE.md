# Superfans — MERN app (project context / handoff)

This is the **MERN rewrite** of the Laravel "Superfans World" app — a Spanish, EUR, adult
creator-subscription platform (like OnlyFans/TikTok hybrid). Goal: **100% identical design +
functionality** to the Laravel original. This folder was moved out of the old monorepo and is
now a standalone git repo (`.git` is here) used for deployment.

## Reference: the Laravel source of truth
The original Laravel app (read-only reference) still lives at:
`C:\Users\LAPTOPS HUB\Documents\superfans`
When matching design/behaviour, **measure the Laravel original first** (blades in
`resources/views/...`, controllers in `app/Http/Controllers/...`) — do NOT guess. Run it with
`php artisan serve --host=127.0.0.1 --port=8000` for side-by-side comparison.

## How to run (dev)
- Backend: `cd backend && npm run dev` (tsx watch, port **5000**). Build: `npm run build` → `npm start`.
- Frontend: `cd frontend && npm run dev` (Vite, port **5173**). Build: `npm run build` (→ `dist/`).
- Frontend calls the API at relative **`/api`** (Vite proxies `/api` and `/assets` → :5000 in dev; nginx does it in prod).
- MongoDB: `mongodb://127.0.0.1:27017/superfans`. Laravel MySQL DB: `superfanslaravel` (root).

## Assets (media for posts)
Served at URL `/assets/images/<file>`, from TWO folders (checked in order), both inside this project:
1. `backend/uploads/` — new posts uploaded via the app
2. `backend/legacy-assets/images/` — migrated Laravel media (`LEGACY_ASSETS_DIR=legacy-assets`, relative)
Thumbnails: `backend/legacy-assets/images/thumbnails/`. Both `legacy-assets/` and `uploads/` are
**gitignored** (6.4 GB) — transfer them to servers via rsync/scp, never git.

### Missing media → posts auto-hidden
`Post.mediaMissing` (bool) flags posts whose media file is absent; a global Mongoose **pre-find +
pre-aggregate hook** hides them from every listing so no broken image reaches the UI. After adding
/ recovering assets, re-run: `cd backend && node scripts/flag-missing-media.mjs`. (Currently ~116
media files are still missing; recovered files un-flag on the next run.) Admin/scripts bypass with
`.setOptions({ withMissing: true })` or `Post.aggregate(p, { withMissing: true })`.

## Status — what's DONE (design + functionality, verified)
Guest pages · normal-user pages · influencer pages · **Admin** panel (CRUD proven) · **Super Ads**
(Ads Center, Ad-Type + type-aware create, My Ads, Inform Ads, Potential Clients, All Ads
moderation, business login/register, access control, sidebar) · Messages page (design) · post
**full-screen viewer** (reels-style: world/profile scroll context, locked-post tile, %Liked pill,
up/down arrows + wheel + keyboard + swipe, follow-state from `viewerFollowing`).

## Status — NOT yet verified (wired, but blocked locally — verify on the live server)
- **Payments** (subscribe/donate/ads → Redsys/Stripe) — needs real keys
- **Streaming** (LiveKit) — needs a reachable LiveKit server
- **Chat** send/receive — needs conversation data + 2 users
- **Emails** (password reset / verification) — needs SMTP

## Data gaps (not code)
- ~116 post media files still missing (hidden via mediaMissing)
- Admin coupons/models/packages/orders empty (empty in Laravel too)
- `ad_campaigns` / `adpayments` / `adformularyleads` not migrated to Mongo (type page historical ads empty)

## ⚠️ Cleanup pending
Admin test account **`celebritiesai@super.world`** was set to role=admin + password `AdminTest123!`
for testing (backups in the old repo: `_adm_mongo.txt`/`_adm_lara.txt`). **Restore it** when admin
testing is done. This account is the ads admin (Laravel id 4465 / mysqlId 4465).

## Testing workflow (how earlier fixes were verified)
- **Probe accounts**: `pepote@gmail.com`/`elpepepepote` (user), `buisness1@gmail.com` (business),
  `celebritiesai@super.world`/`TepazAI` (admin, id 4465). Set a temp password → test → **restore**.
- **Password set/restore pattern** (ALWAYS back up + restore): Mongo via the User model
  (`u.password='ProbeTest123!'; await u.save()` triggers the hash hook); back up the original hash
  to a temp file first, restore after. Laravel via `php artisan tinker`. **`dmartinherrada@gmail.com`
  is DAVID (the client) — never leave his password changed.**
- **Screenshot harness**: puppeteer-core + headless Chrome at
  `C:/Program Files/Google/Chrome/Application/chrome.exe`. Compare :5173 (MERN) vs :8000 (Laravel);
  clip screenshots (dark full-page shots render black in headless). Use `getComputedStyle` +
  `getBoundingClientRect` to MEASURE, not eyeball. Temp scripts (`_v.mjs`) in `backend/`, delete after.
- Windows: `/tmp` → nonexistent `C:\tmp`; use local temp paths. Use forward slashes in the Chrome path.

## Key implementation notes / gotchas
- **`.mov` videos**: use `videoMime(file)` (utils/format) for `<source type>` (`.mov`→`video/quicktime`),
  not hardcoded `video/mp4` — else `.mov` won't play. Applied app-wide.
- **`DataTableShell`** (pages/ads): reusable "Show entries / Search / pagination" table chrome.
- **Full-screen viewer** (`pages/profile/PostFullscreen.tsx`, route `/user/post_detail/:id`):
  world context passes the ordered post-id list via router `state.world` so scroll follows the WORLD
  feed; profile context falls back to the influencer's sibling prev/next (backend `/posts/:id`).
- **Ads model**: `Ad` (paid records, `ads` collection, migrated) vs `AdCampaign` (`adcampaigns`, NOT
  migrated). Type page lists AdCampaigns; My Ads lists Ads. `buildAd()` creates both.
- Super-ads access: guests → `/business/login` (AdsGuard); non-business users are 403'd from the
  `clients-form` + `website-visits` ad types.

## Deployment (VPS, GitHub-linked)
GitHub remote of the OLD monorepo was `superfans-development/superfans`; this standalone folder has
its own `.git` — confirm/point its remote before pushing. Helper files here:
- `backend/ecosystem.config.cjs` (pm2), `deploy.sh` (git pull + build + pm2 restart), `nginx.conf.example`.
- Target: **self-managed Ubuntu VPS, root SSH, no control panel**. Stack: Node (pm2) + MongoDB +
  nginx (serves `frontend/dist`, proxies `/api` & `/assets` → :5000). Prod `.env` from `backend/.env.example`.
- Future updates: `git push` locally → on VPS `cd .../superfans-mern && ./deploy.sh`. Assets & `.env`
  live on the server only.

## Working style the user (Muhammad) expects
Measure the Laravel original first, then implement — he has repeatedly pushed back on guess-based
("andaaza") changes. Verify each fix with a screenshot/DOM check. Be proactive about modals. He
communicates in Roman Urdu; replies to the client (David) should be short English (often for WhatsApp).
