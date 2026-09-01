import { Router, raw } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/errors.js';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { Subscription } from '../models/Subscription.js';
import { PremiumAccess } from '../models/PremiumAccess.js';
import { Ad, AdCampaign, AdPayment } from '../models/ads.js';
import { Cart } from '../models/adminEntities.js';
import { merchProducts } from '../data/merchProducts.js';
import { paymentProvider } from '../services/payments/index.js';
import { logger } from '../config/logger.js';
import { sendMail } from '../services/mailer.js';
import { adPaymentSuccessUser, adPaymentSuccessAdmin } from '../services/adEmails.js';

/* the address AdsPaymentController mails on every ad payment */
const ADMIN_ADS_EMAIL = 'dmartinherrada@gmail.com';

export const paymentsRouter = Router();

const APP = env.PUBLIC_APP_URL;
const CURRENCY = 'eur'; // Spanish market — Laravel used EUR throughout

/**
 * The blade's "premium fan" — a one-off payment that buys priority access to one creator's
 * inbox when they have their chat switched off (user_profile.blade.php:1310-1345, where it
 * posts amount=10, payment_type=one_time to Redsys; the same charge goes through Stripe
 * here). Ten of whatever the site charges in, which is euros.
 */
export const PREMIUM_ACCESS_AMOUNT = 10;

paymentsRouter.post(
  '/premium/:influencerId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const influencer = await User.findById(req.params.influencerId);
    if (!influencer) throw ApiError.notFound('Creator not found');
    const me = await User.findById(req.auth!.userId);
    if (!me) throw ApiError.unauthorized();
    if (String(me._id) === String(influencer._id)) {
      throw ApiError.badRequest('You cannot buy priority access to your own inbox');
    }

    /* it is bought once and kept — the blade says as much: "only for 1 use" and never
       renewed. Paying again would take the money and change nothing. */
    const already = await PremiumAccess.exists({ user: me._id, influencer: influencer._id });
    if (already) throw ApiError.badRequest('You already have priority access to this creator');

    const { url } = await paymentProvider.createCheckout({
      mode: 'payment',
      amount: PREMIUM_ACCESS_AMOUNT,
      currency: CURRENCY,
      description: `Priority access to @${influencer.usernameUrl}`,
      customerEmail: me.email,
      metadata: {
        purpose: 'premium',
        userId: String(me._id),
        influencerId: String(influencer._id),
        amount: String(PREMIUM_ACCESS_AMOUNT),
      },
      successUrl: `${APP}/${influencer.usernameUrl}?premium=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${APP}/${influencer.usernameUrl}?premium=cancelled`,
    });
    res.json({ success: true, url });
  }),
);

/** publishable key + which provider is live, for the frontend. */
paymentsRouter.get('/config', (_req, res) => {
  res.json({
    provider: paymentProvider.name,
    ready: paymentProvider.ready,
    publishableKey: env.STRIPE_PUBLISHABLE_KEY,
  });
});

/* ---------------- fan → creator subscription ---------------- */
paymentsRouter.post(
  '/subscribe/:influencerId',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!paymentProvider.ready) throw ApiError.badRequest('Payments are not configured');
    const influencer = await User.findById(req.params.influencerId);
    if (!influencer) throw ApiError.notFound('Creator not found');
    const me = await User.findById(req.auth!.userId);
    if (!me) throw ApiError.unauthorized();

    const amount = influencer.priceOfSubscription ?? 0;
    if (amount <= 0) throw ApiError.badRequest('This creator has no subscription price set');

    const { url } = await paymentProvider.createCheckout({
      mode: 'subscription',
      amount,
      currency: CURRENCY,
      interval: 'month',
      description: `Subscription to @${influencer.usernameUrl}`,
      customerEmail: me.email,
      metadata: {
        purpose: 'subscription',
        userId: String(me._id),
        influencerId: String(influencer._id),
        amount: String(amount),
      },
      successUrl: `${APP}/${influencer.usernameUrl}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${APP}/${influencer.usernameUrl}?payment=cancelled`,
    });
    res.json({ success: true, url });
  }),
);

/** cancel_subscription — cancels at the provider, then drops the local record. */
paymentsRouter.delete(
  '/subscription/:influencerId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const sub = await Subscription.findOne({
      user: req.auth!.userId,
      influencer: req.params.influencerId,
    });
    if (!sub) throw ApiError.notFound('Subscription not found');
    if (sub.externalId && paymentProvider.ready) {
      await paymentProvider.cancelSubscription(sub.externalId).catch(() => undefined);
    }
    await sub.deleteOne();
    res.json({ success: true, message: 'Unsubscribed' });
  }),
);

/* ---------------- merchandising (one-time) ---------------- */
paymentsRouter.post(
  '/merch/checkout',
  optionalAuth,
  asyncHandler(async (req, res) => {
    if (!paymentProvider.ready) throw ApiError.badRequest('Payments are not configured');
    const { slug, amount, email, referredInfluencerId } = z
      .object({
        slug: z.string(),
        amount: z.coerce.number().positive(),
        email: z.string().email().optional(),
        referredInfluencerId: z.string().optional(),
      })
      .parse(req.body);

    const { url } = await paymentProvider.createCheckout({
      mode: 'payment',
      amount,
      currency: CURRENCY,
      description: `Merchandising: ${slug}`,
      customerEmail: email,
      metadata: {
        purpose: 'merch',
        slug,
        amount: String(amount),
        email: email ?? '',
        userId: req.auth?.userId ?? '',
        referredInfluencerId: referredInfluencerId ?? '',
      },
      successUrl: `${APP}/merchandising/${slug}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${APP}/merchandising/${slug}?payment=cancelled`,
    });
    res.json({ success: true, url });
  }),
);

/* ---------------- verified account (recurring) ---------------- */
paymentsRouter.post(
  '/verified',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!paymentProvider.ready) throw ApiError.badRequest('Payments are not configured');
    const { plan } = z.object({ plan: z.enum(['quinzenal', 'monthly']) }).parse(req.body);
    const me = await User.findById(req.auth!.userId);
    if (!me) throw ApiError.unauthorized();

    const amount = plan === 'monthly' ? 49.99 : 26.99;
    const { url } = await paymentProvider.createCheckout({
      mode: 'subscription',
      amount,
      currency: CURRENCY,
      interval: 'month',
      description: 'Verified account',
      customerEmail: me.email,
      metadata: { purpose: 'verified', userId: String(me._id), plan },
      successUrl: `${APP}/user?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${APP}/user?payment=cancelled`,
    });
    res.json({ success: true, url });
  }),
);

/** cancel verification (unsubscribe from the verified plan). */
paymentsRouter.delete(
  '/verified',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = await User.findById(req.auth!.userId);
    if (!me) throw ApiError.unauthorized();
    me.verified = false;
    await me.save();
    res.json({ success: true, message: 'Verification cancelled' });
  }),
);

/* ---------------- streaming "server pack" boost (recurring) ---------------- */
// Mirrors start-stream.blade's four plans (1K/5K/25K/100K → 99/199/499/999 recurring).
const STREAM_BOOST_PLANS: Record<string, number> = { '1K': 99, '5K': 199, '25K': 499, '100K': 999 };

paymentsRouter.post(
  '/stream-boost',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!paymentProvider.ready) throw ApiError.badRequest('Payments are not configured');
    const { plan } = z.object({ plan: z.enum(['1K', '5K', '25K', '100K']) }).parse(req.body);
    const me = await User.findById(req.auth!.userId);
    if (!me) throw ApiError.unauthorized();

    const amount = STREAM_BOOST_PLANS[plan];
    const { url } = await paymentProvider.createCheckout({
      mode: 'subscription',
      amount,
      currency: CURRENCY,
      interval: 'month',
      description: `Streaming server pack ${plan}`,
      customerEmail: me.email,
      metadata: { purpose: 'stream_boost', userId: String(me._id), plan },
      successUrl: `${APP}/user?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${APP}/user?payment=cancelled`,
    });
    res.json({ success: true, url });
  }),
);

/* ---------------- live-stream donation (one-time) ---------------- */
paymentsRouter.post(
  '/donation',
  optionalAuth,
  asyncHandler(async (req, res) => {
    if (!paymentProvider.ready) throw ApiError.badRequest('Payments are not configured');
    const { influencerId, amount } = z
      .object({ influencerId: z.string(), amount: z.coerce.number().positive().max(100000) })
      .parse(req.body);
    const influencer = await User.findById(influencerId);
    if (!influencer) throw ApiError.notFound('Creator not found');

    const { url } = await paymentProvider.createCheckout({
      mode: 'payment',
      amount,
      currency: CURRENCY,
      description: `Donation to @${influencer.usernameUrl}`,
      metadata: {
        purpose: 'donation',
        influencerId: String(influencer._id),
        userId: req.auth?.userId ?? '',
        amount: String(amount),
      },
      successUrl: `${APP}/${influencer.usernameUrl}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${APP}/${influencer.usernameUrl}?payment=cancelled`,
    });
    res.json({ success: true, url });
  }),
);

/* ---------------- verify-on-return (belt-and-braces with the webhook) ---------------- */
paymentsRouter.get(
  '/verify/:reference',
  asyncHandler(async (req, res) => {
    if (!paymentProvider.ready) throw ApiError.badRequest('Payments are not configured');
    const reference = String(req.params.reference);
    const { paid, metadata } = await paymentProvider.verifyCheckout(reference);
    if (paid) await applyPayment(metadata, undefined, reference);
    res.json({ success: true, paid });
  }),
);

/**
 * applyPayment — reconciles a successful payment into the app state, idempotently.
 * Called from both the webhook and verify-on-return so a payment always lands even if
 * one path is missed.
 */
async function applyPayment(
  metadata: Record<string, string>,
  externalId?: string,
  reference?: string,
): Promise<void> {
  const nextMonth = new Date(Date.now() + 30 * 24 * 3600 * 1000);
  if (metadata.purpose === 'subscription' && metadata.userId && metadata.influencerId) {
    await Subscription.updateOne(
      { user: metadata.userId, influencer: metadata.influencerId },
      {
        $set: {
          amount: Number(metadata.amount) || 0,
          plan: 'monthly',
          nextPaymentAt: nextMonth,
          provider: paymentProvider.name,
          status: 'active',
          ...(externalId ? { externalId } : {}),
        },
      },
      { upsert: true },
    );
  } else if (metadata.purpose === 'premium' && metadata.userId && metadata.influencerId) {
    /* One row per fan/creator pair, and the session id carries the idempotency: a webhook
       Stripe sends twice must not write twice, and the unique pair means a second payment
       for the same creator cannot either. */
    await PremiumAccess.updateOne(
      { user: metadata.userId, influencer: metadata.influencerId },
      {
        $setOnInsert: {
          user: metadata.userId,
          influencer: metadata.influencerId,
          amount: Number(metadata.amount) || PREMIUM_ACCESS_AMOUNT,
          ...(externalId ? { sessionId: externalId } : {}),
        },
      },
      { upsert: true },
    );
  } else if (metadata.purpose === 'verified' && metadata.userId) {
    await User.updateOne({ _id: metadata.userId }, { $set: { verified: true } });
  } else if (metadata.purpose === 'ads' && metadata.userId && metadata.adId) {
    // Record the ad payment idempotently (one AdPayment per ad).
    const exists = await AdPayment.exists({ ad: metadata.adId });
    if (!exists) {
      await AdPayment.create({
        user: metadata.userId,
        ad: metadata.adId,
        amount: Number(metadata.amount) || 0,
        method: paymentProvider.name,
      });
    }
    // The campaign leaves 'draft' and enters review once paid. Read first: the
    // mail below quotes the run length it carries.
    const campaign = await AdCampaign.findOne(
      { user: metadata.userId, status: 'draft' },
      { campaignDays: 1, type: 1 },
    ).lean();
    await AdCampaign.updateOne(
      { user: metadata.userId, status: 'draft' },
      { $set: { status: 'active' } },
    );

    /* AdsPaymentController:248 mails the advertiser and the admin on a
       successful ad payment. Sent once, alongside the AdPayment row. */
    if (!exists) {
      const [payer, ad] = await Promise.all([
        User.findById(metadata.userId, { name: 1, email: 1, role: 1 }).lean(),
        Ad.findById(metadata.adId, { adType: 1, link: 1 }).lean(),
      ]);
      if (payer?.email) {
        const amount = Number(metadata.amount) || 0;
        const adType = ad?.adType ?? campaign?.type ?? '—';
        const linkUrl = ad?.link ?? null;
        const durationDays = campaign?.campaignDays ?? '—';

        const forUser = adPaymentSuccessUser({ name: payer.name ?? '', adType, linkUrl, amount, durationDays });
        void sendMail(payer.email, forUser.subject, forUser.html).catch(() => undefined);

        const forAdmin = adPaymentSuccessAdmin({
          name: payer.name ?? '',
          email: payer.email,
          role: payer.role ?? 'user',
          adType,
          linkUrl,
          amount,
          durationDays,
        });
        void sendMail(ADMIN_ADS_EMAIL, forAdmin.subject, forAdmin.html).catch(() => undefined);
      }
    }
  } else if (metadata.purpose === 'donation' && metadata.influencerId) {
    // Credit the creator's earnings once per gateway reference.
    const key = reference || externalId;
    const already = key ? await Cart.exists({ reference: key }) : false;
    if (!already) {
      await User.updateOne({ _id: metadata.influencerId }, { $inc: { earnings: Number(metadata.amount) || 0 } });
      // Reuse a Cart row as an idempotency/audit marker for the donation.
      if (key) {
        await Cart.updateOne(
          { reference: key },
          { $setOnInsert: { reference: key, productSlug: 'donation', productName: 'Live donation', productPrice: Number(metadata.amount) || 0, user: metadata.userId || undefined, paymentStatus: 1 } },
          { upsert: true },
        );
      }
    }
  } else if (metadata.purpose === 'merch' && metadata.slug) {
    // Persist a paid merch order so it shows up in the admin Orders page. Idempotent by
    // the gateway reference when we have it, else by (slug + email + minute) as a guard.
    const product = merchProducts.find((p) => p.slug === metadata.slug);
    const dedupe = reference
      ? { reference }
      : { productSlug: metadata.slug, buyerEmail: metadata.email || undefined, paymentStatus: 1 };
    await Cart.updateOne(
      dedupe,
      {
        $setOnInsert: {
          user: metadata.userId || undefined,
          productSlug: metadata.slug,
          productName: product?.name ?? metadata.slug,
          productPrice: Number(metadata.amount) || product?.price || 0,
          buyerEmail: metadata.email || undefined,
          referredInfluencer: metadata.referredInfluencerId || undefined,
          reference,
          paymentStatus: 1,
        },
      },
      { upsert: true },
    );
  }
}

/* ---------------- webhook (raw body for signature verification) ---------------- */
paymentsRouter.post(
  '/webhook',
  raw({ type: '*/*' }),
  asyncHandler(async (req, res) => {
    let event;
    try {
      const sig = req.headers['stripe-signature'];
      event = paymentProvider.parseWebhook(req.body as Buffer, Array.isArray(sig) ? sig[0] : sig);
    } catch (e) {
      logger.warn({ err: String(e) }, 'payment webhook rejected');
      res.status(400).send('bad signature');
      return;
    }

    if (event.type === 'checkout.completed') {
      await applyPayment(event.metadata, event.subscriptionId, event.reference);
    } else if (event.type === 'subscription.renewed') {
      // Renewals carry the Stripe subscription id but usually no metadata, so bump the
      // local record by externalId. Fall back to applyPayment when metadata is present.
      const nextMonth = new Date(Date.now() + 30 * 24 * 3600 * 1000);
      const bumped = event.subscriptionId
        ? await Subscription.updateOne(
            { externalId: event.subscriptionId },
            { $set: { nextPaymentAt: nextMonth, status: 'active' } },
          )
        : { matchedCount: 0 };
      if (!bumped.matchedCount && event.metadata.userId) {
        await applyPayment(event.metadata, event.subscriptionId);
      }
    } else if (event.type === 'subscription.cancelled' && event.subscriptionId) {
      await Subscription.deleteOne({ externalId: event.subscriptionId });
      if (event.metadata.purpose === 'verified' && event.metadata.userId) {
        await User.updateOne({ _id: event.metadata.userId }, { $set: { verified: false } });
      }
    }
    res.json({ received: true });
  }),
);
