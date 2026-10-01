import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),

  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/superfans'),

  JWT_ACCESS_SECRET: z.string().min(10, 'JWT_ACCESS_SECRET must be set'),
  JWT_REFRESH_SECRET: z.string().min(10, 'JWT_REFRESH_SECRET must be set'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  STORAGE_DRIVER: z.enum(['local', 'cloudinary']).default('local'),
  UPLOADS_DIR: z.string().default('uploads'),
  /** Read-only path to the original Laravel public/assets/images so migrated media resolves in dev */
  LEGACY_ASSETS_DIR: z.string().optional().default(''),

  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  MAIL_FROM: z.string().optional().default('Superfans World <no-reply@superfans.local>'),

  STRIPE_SECRET_KEY: z.string().optional().default(''),
  STRIPE_PUBLISHABLE_KEY: z.string().optional().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),
  /** which payment adapter is live (stripe today; paypal/verotel/redsys later) */
  PAYMENT_PROVIDER: z.enum(['stripe', 'paypal', 'redsys']).optional().default('stripe'),
  LIVEKIT_API_KEY: z.string().optional().default(''),
  LIVEKIT_API_SECRET: z.string().optional().default(''),
  /** The blade hardcodes this endpoint in watch-live.blade.php */
  LIVEKIT_URL: z.string().optional().default('wss://livekit.superfansstream.xyz'),
  CLOUDINARY_URL: z.string().optional().default(''),

  /** Redsys (the live payment gateway for subscriptions + verified accounts + merch). */
  REDSYS_ENVIRONMENT: z.enum(['test', 'production', 'prod']).optional().default('test'),
  REDSYS_TERMINAL: z.coerce.number().default(1),
  REDSYS_MERCHANT_CODE: z.string().optional().default(''),
  REDSYS_KEY: z.string().optional().default(''),
  REDSYS_ORDER_NUM_PREFIX: z.string().optional().default(''),
  /** Where Redsys sends the browser back / posts the async notification. */
  PUBLIC_APP_URL: z.string().optional().default('http://localhost:5173'),
  PUBLIC_API_URL: z.string().optional().default('http://localhost:5000'),

  /**
   * The growth bot's minute clock (see server.ts).
   *
   * Laravel ran `growth:process` from the system scheduler, so on a real server this belongs
   * on and the default follows NODE_ENV. It is explicit and defaults to OFF everywhere else
   * because a dev machine points at a copy of the live database: a bot left ticking there
   * rewrites the client's own like and follower counts, which is not ours to do.
   *
   * A blank value counts as unset. Every other optional key here tolerates an empty string,
   * and `.env.example` ships most of them blank — without this, copying that file and
   * clearing the value stops the API booting at all rather than just leaving the bot off.
   */
  GROWTH_BOT: z.preprocess((v) => (v === '' ? undefined : v), z.enum(['on', 'off']).optional()),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    // eslint-disable-next-line no-console
    console.error(`   ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
/** Growth bot: whatever GROWTH_BOT says, else on in production and off in dev/test. */
export const growthBotEnabled = env.GROWTH_BOT ? env.GROWTH_BOT === 'on' : isProd;
