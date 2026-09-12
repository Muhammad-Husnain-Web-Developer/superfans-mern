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

  /**
   * nginx sits in front of this process and forwards every request over the loopback, so
   * without this `req.ip` is nginx's own address and never the visitor's. It was: of the 563
   * post visits recorded on the live server in the last thirty days, all 563 read
   * `::ffff:127.0.0.1`.
   *
   * `loopback` rather than a hop count or `true`: only a proxy on 127.0.0.1 is believed, which
   * is exactly our nginx. A visitor cannot then hand us a forged `X-Forwarded-For` and be
   * taken at their word, which `true` would allow — and the country a post is stamped with is
   * about to depend on this being honest.
   */
  app.set('trust proxy', 'loopback');
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
