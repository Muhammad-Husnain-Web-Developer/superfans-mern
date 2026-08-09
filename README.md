# Superfans MERN

MERN rewrite of the Superfans platform. The Laravel app at the repo root is the
read-only reference — see [docs/ARCHITECTURE-ANALYSIS.md](docs/ARCHITECTURE-ANALYSIS.md)
and [docs/MIGRATION-PLAN.md](docs/MIGRATION-PLAN.md).

## Stack

- **Backend** (`backend/`): Express 5 + TypeScript + Mongoose, JWT (httpOnly cookies), Zod, Pino
- **Frontend** (`frontend/`): React 19 + Vite + Tailwind CSS 4 + React Router + i18next (8 locales)
- **Database**: MongoDB (local dev: portable server, see below)

## Development

Three terminals:

```powershell
# 1. MongoDB (portable install under %USERPROFILE%\mongodb)
.\scripts\start-mongo.ps1

# 2. API on http://localhost:5000
cd backend
copy .env.example .env   # first time only — fill JWT secrets
npm install
npm run dev

# 3. Frontend on http://localhost:5173 (proxies /api → :5000)
cd frontend
npm install
npm run dev
```

Health check: `GET http://localhost:5000/api/health` → `{ success, db: "connected" }`.

## Milestone status

- [x] **M0 — Foundations**: backend scaffold (config/db/errors/logging/health), frontend shell
      (router, layout, design tokens from the original app, i18n with 8 converted locales, API client)
- [ ] M1 — Auth & users (+ user data migration)
- [ ] M2 — Profiles & media service
- [ ] M3 — Posts & engagement
- [ ] M4 — World feed & rankings
- [ ] M5 — Follows & Stripe subscriptions
- [ ] M6 — Chat (Socket.io)
- [ ] M7 — Growth engine & admin
- [ ] M8 — Merchandising & news
- [ ] M9 — Ads Center
- [ ] M10 — Live streaming
- [ ] M11 — PayPal + Redsys
- [ ] M12 — Cutover readiness
