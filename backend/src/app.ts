import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { apiRouter } from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { uploadsDir } from './services/storage.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
      credentials: true,
    }),
  );
  // The payment webhook needs the raw body for signature verification, so JSON parsing
  // must skip it (the route mounts its own express.raw()).
  app.use((req, res, next) => {
    if (req.originalUrl === '/api/payments/webhook') return next();
    return express.json({ limit: '20mb' })(req, res, next);
  });
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Assets: same URL shape as Laravel (/assets/...). New uploads first, then the
  // read-only legacy Laravel public/assets folder (css, fonts, images, pics, music)
  // so migrated media and the original site stylesheets resolve unchanged.
  app.use('/assets/images', express.static(uploadsDir(), { fallthrough: true }));
  if (env.LEGACY_ASSETS_DIR) {
    const legacyDir = path.resolve(env.LEGACY_ASSETS_DIR);
    if (fs.existsSync(legacyDir)) {
      app.use('/assets', express.static(legacyDir, { fallthrough: true }));
    }
  }

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
