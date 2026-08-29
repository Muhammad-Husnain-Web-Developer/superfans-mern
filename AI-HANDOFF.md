# Superfans — working brief for an AI assistant without repo access

You are helping maintain **Superfans**, a production web app. You cannot see the repository.
The developer (Muhammad) will paste files to you on request. Work the way this document
describes; it is the difference between a patch that applies and one that wastes his evening.

---

## 1. How to answer (protocol — read this first)

For every task he gives you:

1. **Do not write code yet.** First name the exact files you need, using section 5's index.
   Ask for the smallest set that can possibly be enough — usually 1–3 files.
   Say it plainly, e.g.
   > To do this I need: `frontend/src/components/RatingPill.tsx` and
   > `frontend/src/styles/rating-pill.css`. Paste them and I'll write the change.
2. **When he pastes them, read before writing.** If what you see contradicts your assumption,
   say so and ask for the one extra file that resolves it, rather than guessing.
3. **Then return the change** as either
   - the **complete updated file** (preferred when it is under ~200 lines), or
   - an **exact find-and-replace**: the old block verbatim, then the new block.
     Never say "add this somewhere near the top" — he applies these by hand.
4. **State what to check afterwards.** One or two concrete things: "open /user/feed at 390px
   and confirm the pill's label sits on the red".
5. If a task cannot be done without a decision the client must make (a colour, a wording, a
   rule), **ask the question instead of inventing an answer**.

Never invent file paths, component names, CSS classes or API routes. If you need one and it
is not in this document, ask.

---

## 2. What the app is

- A Spanish-language, EUR, adult creator-subscription platform (OnlyFans/TikTok hybrid).
- It is a **MERN rewrite of an older Laravel app**. The Laravel original is the design and
  behaviour reference: when something is being *ported*, the Laravel blade/controller decides
  what is correct — not taste, not convention.
- Some newer work has **no Laravel original** (Stories, the ❤️/💩 rating pill on the walls,
  the Super-Ads centre extensions). There the client's instructions decide.
- The client is David; he sends requests as short English notes and screenshots, often with
  arrows or circles drawn on them.

**Stack**

| Side | Stack |
|---|---|
| backend | Node + Express + TypeScript, Mongoose/MongoDB, `tsx watch` in dev, `tsc` → `dist/` in prod |
| frontend | React 19 + TypeScript + Vite, react-router-dom, i18next, axios, Tailwind v4 present but barely used |
| styling | mostly plain CSS files extracted from the Laravel theme, not utility classes |

Dev: `cd backend && npm run dev` (port 5000) · `cd frontend && npm run dev` (port 5173, proxies
`/api` and `/assets` to 5000). Mongo at `mongodb://127.0.0.1:27017/superfans`.

Checks before handing code back: `cd frontend && npx tsc --noEmit -p tsconfig.app.json`,
`cd backend && npx tsc --noEmit`.

---

## 3. Repository map

```
backend/src
  server.ts app.ts
  config/           env loading
  models/           Mongoose schemas: User, Post, Like, Hate, Followership, Subscription,
                    Story, Ad, ads.ts (AdCampaign/AdUserProfile/AdFormulary…), News, ChatMessage
  routes/           auth, users, me, posts, profiles, world, stories, ads, admin, payments,
                    chat, news, rankings, merchandising, stream, uploads, index.ts
  services/         mailer.ts, emailTemplate.ts (the mail shell), adEmails.ts, storage.ts,
                    realtime.ts, videoDuration.ts, payments/
  middleware/       auth (requireAuth / optionalAuth), errors (ApiError), asyncHandler

frontend/src
  App.tsx           the whole route table + route guards
  api/              axios client and typed calls (profiles.ts, auth.ts, stories.ts…)
  context/          AuthContext (user + role: 'user' | 'influencer' | 'business' | 'admin')
  pages/
    world/          World.tsx (the World feed), UserFeed.tsx (MY FEED), Influencers.tsx
    profile/        Profile.tsx (a wall + the PostItem card), Posts.tsx (all posts),
                    PostFullscreen.tsx (reels viewer), ProfileSidebar.tsx (the left nav),
                    AddPostModal/Host, ControlPanelModal/Host, UserModalCenter…
    ads/            AdsCenter, AdsType, MyAds, AllAds, AdsInformation, PotentialClients,
                    AdLeadForm, AdsPreview, DataTableShell, LocationPicker
    admin/          AdminUsers, AllUsers, AllUserPosts, AdManagement, AdminGrowth…
    auth/           Login, BusinessLogin, Register*, ForgotPassword, ResetPassword, Logout
    chat/ news/ rankings/ stories/ stream/ merch/ errors/
  components/       RatingPill.tsx, PostHeading.tsx, VolumeButton.tsx, NavToggle.tsx,
                    RegisterModal.tsx, MobileFooterMenu.tsx, PageLoader.tsx, stories/*
  styles/           world-page.css, profile-page.css, posts-page.css, rating-pill.css,
                    stories.css, story-editor.css, post-heading.css, nav-toggle.css,
                    layout-direct-user.css, footer-modals.css, ad-card.css …
  utils/            format.ts (assetImage, videoMime, formatNumber, likePercent, likeLevel…),
                    video.ts (observeNewVideos), postSounds.ts, useRatingFeedback.ts,
                    businessAccess.ts, useScrollMemory.ts, feedMemory.ts
  i18n/             index.ts + locales/{en,es,ca,fr,de,it,pt,cn}/*.json
frontend/public/    brand/ (logos, artwork), sounds/, page-css/ (stylesheets loaded at runtime)
```

---

## 4. House rules

- **Touch only what was asked.** No refactors, no renames, no "while I was here" changes, no
  new dependencies, no new build tooling.
- **Match the surrounding code**: same naming, same comment density, same import style.
  Comments explain *why*, never restate the code.
- **Never guess a value.** If you need to know a colour, a size, or what the Laravel original
  did, ask for the file or say the measurement is needed.
- **CSS is layered.** Several stylesheets are verbatim extracts from the Laravel theme and
  still apply. Prefer a more specific selector over editing an extract, and say which rule you
  are overriding and why.
- **The app is live.** Do not suggest running deploys, migrations, or database writes. Never
  ask for `.env` contents, keys, or passwords.

---

## 5. Task → files index

Ask for exactly these when a task touches an area.

| Task is about | Ask for |
|---|---|
| ❤️/💩 rating bar (levels, colours, hover, sizes) | `frontend/src/components/RatingPill.tsx`, `frontend/src/styles/rating-pill.css`, `frontend/src/utils/format.ts` |
| Where the bar appears (a wall/feed card) | above **plus** the page: `pages/world/World.tsx`, `pages/world/UserFeed.tsx` or `pages/profile/Profile.tsx` |
| Like / hate behaviour, counts, sounds | `frontend/src/utils/useRatingFeedback.ts`, `frontend/src/utils/postSounds.ts`, `backend/src/routes/posts.routes.ts`, `backend/src/routes/me.routes.ts` |
| World feed content, ordering, ad injection | `backend/src/routes/world.routes.ts`, `frontend/src/pages/world/World.tsx` |
| MY FEED page | `backend/src/routes/me.routes.ts` (the `/feed` handler), `frontend/src/pages/world/UserFeed.tsx` |
| A profile wall / all-posts grid | `frontend/src/pages/profile/Profile.tsx`, `frontend/src/pages/profile/Posts.tsx`, `backend/src/routes/profiles.routes.ts` |
| Full-screen post viewer | `frontend/src/pages/profile/PostFullscreen.tsx`, `backend/src/routes/posts.routes.ts` |
| The post heading strip (@handle, tags, blue tick, marquee) | `frontend/src/components/PostHeading.tsx`, `frontend/src/styles/post-heading.css` |
| Videos (autoplay, mute button, controls) | `frontend/src/utils/video.ts`, `frontend/src/components/VolumeButton.tsx`, plus the page that renders the card |
| Stories (strip, viewer, editor, upload) | `frontend/src/components/stories/*`, `frontend/src/styles/stories.css`, `story-editor.css`, `backend/src/routes/stories.routes.ts`, `backend/src/models/Story.ts` |
| Left sidebar / nav labels / mobile handle | `frontend/src/pages/profile/ProfileSidebar.tsx`, `frontend/src/components/NavToggle.tsx`, `frontend/src/styles/nav-toggle.css`, `frontend/public/page-css/layout-direct-user.css`, `frontend/src/i18n/locales/en/nav.json` |
| Routes, redirects, access by role | `frontend/src/App.tsx`, `frontend/src/utils/businessAccess.ts`, `frontend/src/utils/postLoginRedirect.ts` |
| Super Ads (create, types, my ads, moderation) | `frontend/src/pages/ads/*`, `backend/src/routes/ads.routes.ts`, `backend/src/models/ads.ts` |
| Admin panel | `frontend/src/pages/admin/*`, `backend/src/routes/admin.routes.ts` |
| Emails | `backend/src/services/emailTemplate.ts`, `backend/src/services/adEmails.ts`, and the route that sends it |
| Payments (Stripe / Redsys) | `backend/src/routes/payments.routes.ts`, `backend/src/services/payments/*` |
| Translations / wording | `frontend/src/i18n/locales/<lang>/<namespace>.json` (namespaces: auth, content, footer, nav, report, stories, validation) |

---

## 6. Things that will bite you

1. **Translations are bundled at build time.** `i18n/index.ts` uses
   `import.meta.glob('./locales/*/*.json', { eager: true })`. Editing a JSON has no effect
   until the frontend is rebuilt, and there are **8 languages** — a label change must be made
   in all of them.
2. **Old Laravel CSS is still loaded.** `frontend/src/styles/world-page.css` and
   `frontend/public/page-css/layout-direct-user.css` are verbatim extracts of the original
   theme. Their rules (e.g. `.rating-pill:hover`, `.liked-segment { background }`) will fight
   new code. Beat them with a more specific selector such as
   `.stats-wrapper.has-actions .rating-pill`, and leave the extract alone.
3. **Media URLs**: post media is served at `/assets/images/<file>` by the backend — always via
   `assetImage()` from `utils/format.ts`. Artwork and sounds that ship with the frontend live
   in `frontend/public/brand/…` and `frontend/public/sounds/…` and are referenced by plain
   absolute paths.
4. **`.mov` videos** need `videoMime(file)` for the `<source type>`, never a hardcoded
   `video/mp4`.
5. **Videos do not autoplay by themselves.** They carry the class `autoplay-video` and the
   page must call `observeNewVideos()` after the list changes. The mute button is
   `<VolumeButton videoId="video-<id>" />` inside a `.video-wrapper`.
6. **Posts with missing media are hidden globally** by a Mongoose pre-find/pre-aggregate hook
   (`Post.mediaMissing`). Admin queries bypass it with `.setOptions({ withMissing: true })`.
7. **The rating pill is a track, not two halves.** The grey pill has a fixed width; the red
   part carries the `👍 N% Liked` label and is at least as wide as that label, growing to the
   level's width (`min-width: var(--sf-fill)`), with a diagonal clip-path as the divider.
   The percentage comes from `likePercent(likes, hates, seed)` and is clamped to **10–93**;
   the bar snaps to 4 levels via `likeLevel()`.
8. **Cards click through to the viewer from the media only** — the handle strip and the stats
   row must not open it.
9. **Roles**: `user`, `influencer`, `business`, `admin`. A `business` account may only use the
   Super Ads Center; `utils/businessAccess.ts` + the `BusinessScope` guard in `App.tsx` push
   it back to `/super-ads` everywhere else, except a public profile at `/{username}`.
10. **Breakpoints in use**: 768px and 480px. The post grid is 3 columns on desktop, 2 on
    tablet, 1 on a phone — space is very tight on desktop cards (~290px of usable row width),
    so anything added there must be measured, not eyeballed.

---

## 7. How Muhammad will verify

He runs the app locally and looks at the real page, often with a headless-Chrome script that
measures elements (`getBoundingClientRect`, `getComputedStyle`) instead of eyeballing. So:

- Give him something checkable: "the two labels should now have ≥10px between them".
- If your change depends on a number (a width, a gap, a font size), say which number and where
  it came from.
- If you are not sure your fix covers phones as well as desktop, say so.

---

## 8. Prompt to paste with this file

> Here is the working brief for my project (AI-HANDOFF.md). Follow its protocol: for my task,
> first tell me exactly which files you need, wait for me to paste them, then give me the
> complete updated file or an exact find-and-replace. Do not guess file paths or invent code
> you have not seen. My task is: …
