#!/usr/bin/env bash
# One-command redeploy after pushing code to GitHub. Run on the VPS:
#   cd /var/www/superfans/superfans-mern && ./deploy.sh
# Assets (backend/legacy-assets, backend/uploads) and .env are NOT touched — they live
# on the server only and are never in git.
set -euo pipefail

echo "==> Pulling latest code"
#git pull origin main

echo "==> Backend: install + build + restart"
cd backend
npm ci
npm run build
pm2 restart superfans-api || pm2 start ecosystem.config.cjs
cd ..

echo "==> Frontend: install + build (nginx serves ./frontend/dist)"
cd frontend
npm ci
npm run build
cd ..

echo "==> Done. Backend reloaded, frontend rebuilt."
