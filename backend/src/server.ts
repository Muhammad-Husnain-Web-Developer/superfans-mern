import http from 'node:http';
import { createApp } from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { env, growthBotEnabled } from './config/env.js';
import { initRealtime } from './services/realtime.js';
import { logger } from './config/logger.js';
import { runGrowthTick } from './routes/admin.routes.js';

async function main() {
  await connectDB();

  const app = createApp();
  const server = http.createServer(app);
  initRealtime(server);

  server.listen(env.PORT, () => {
    logger.info(`API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  /**
   * The growth bot's clock.
   *
   * Laravel ran `growth:process` every minute from its own scheduler (app/Console/Kernel.php).
   * Nothing carried that over, so turning Growth on in the admin panel set three fields and
   * then nothing ever happened — which is exactly what the client reported. The interval lives
   * in the API process rather than in a system cron: pm2 already keeps this process up, and a
   * cron entry is one more thing to install on the server and to notice when it stops.
   *
   * Errors are logged and swallowed: a bad tick must never take the API down with it, and the
   * next minute tries again. `unref` so the timer alone never holds the process open on exit.
   *
   * Off unless GROWTH_BOT says otherwise (on in production by default). A dev machine runs
   * against a copy of the live database, and 239 accounts are growth-active in it — left
   * ticking here the bot silently rewrites the client's real like and follower counts.
   */
  if (growthBotEnabled) {
    const growthTimer = setInterval(() => {
      void runGrowthTick()
        .then(({ users, posts }) => {
          if (users > 0) logger.info({ users, posts }, 'growth tick');
        })
        .catch((err) => logger.error({ err }, 'growth tick failed'));
    }, 60_000);
    growthTimer.unref();
    logger.info('growth bot: on (ticking every 60s)');
  } else {
    logger.info('growth bot: off (set GROWTH_BOT=on to enable)');
  }

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down`);
    server.close();
    await disconnectDB();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error({ err }, 'Fatal startup error');
  process.exit(1);
});
