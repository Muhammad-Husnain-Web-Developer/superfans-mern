import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/errors.js';
import { saveBase64Media } from '../services/storage.js';
import { paymentProvider } from '../services/payments/index.js';
import { sendMail } from '../services/mailer.js';
import {
  adCreatedUser,
  adCreatedAdmin,
  adStatusChanged,
  vipAccessRequestAdmin,
} from '../services/adEmails.js';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { Post } from '../models/Post.js';
import { Followership } from '../models/Followership.js';
import { Subscription } from '../models/Subscription.js';
import { PremiumAccess } from '../models/PremiumAccess.js';
import {
  AD_TYPES,
  Ad,
  AdCampaign,
  AdCampaignDetail,
  AdFormularyForm,
  AdFormularyLead,
  AdPayment,
  AdUserProfile,
  type AdType,
} from '../models/ads.js';

/* the address AdsPaymentController mails on every ad event */
const ADMIN_ADS_EMAIL = 'dmartinherrada@gmail.com';

export const adsRouter = Router();

const APP = env.PUBLIC_APP_URL;
const CURRENCY = 'eur';

/** The dashboard card set — mirrors the validTypes used across the Laravel controllers. */
const VALID_TYPES = new Set<string>(AD_TYPES);

/** Audience per type (from adsInformation()); used for the spent/remaining estimate. */
const AUDIENCE_MAP: Record<string, number> = {
  'promote-post': 650000,
  'profile-followers': 650000,
  messages: 150000,
  instagram: 560000,
  tiktok: 560000,
  twitch: 115000,
  youtube: 560000,
  amazon: 920000,
  spotify: 920000,
  'website-visits': 920000,
  calls: 75000,
  whatsapp: 92000,
  'clients-form': 300000,
  'super-video': 1380000,
};

/** Ad types only business accounts may use — Laravel 403s normal users on these (restrict_super_ads). */
const BUSINESS_ONLY_TYPES = new Set(['clients-form', 'website-visits']);

/** Throw 403 when a non-business user touches a business-only ad type. */
async function assertTypeAllowed(userId: string, type: string): Promise<void> {
  if (!BUSINESS_ONLY_TYPES.has(type)) return;
  const u = await User.findById(userId, { role: 1 });
  if (u?.role !== 'business') throw ApiError.forbidden('Access denied.');
}

/** Whether the caller is the ads admin (Laravel hardcodes user id 4465). */
async function isAdsAdmin(userId: string): Promise<boolean> {
  const u = await User.findById(userId, { role: 1, mysqlId: 1 });
  return !!u && (u.role === 'admin' || u.mysqlId === 4465);
}

/** Compute which advertiser-profile fields are still missing (gate before creating ads). */
function missingProfileFields(
  role: string,
  profile: {
    name?: string;
    surnames?: string;
    country?: string;
    address?: string;
    zipCode?: string;
    mobileNumber?: string;
    isMarketingAgency?: boolean;
    isTalentAgency?: boolean;
    isFreelancer?: boolean;
    isCompany?: boolean;
    companySize?: string;
  } | null,
): string[] {
  if (!profile) {
    return ['name', 'surnames', 'country', 'address', 'zip_code', 'mobile_number', 'business_type'];
  }
  const missing: string[] = [];
  const required: [keyof typeof profile, string][] = [
    ['name', 'name'],
    ['surnames', 'surnames'],
    ['country', 'country'],
    ['address', 'address'],
    ['zipCode', 'zip_code'],
    ['mobileNumber', 'mobile_number'],
  ];
  for (const [key, label] of required) if (!profile[key]) missing.push(label);

  if (role === 'business') {
    const hasType =
      profile.isMarketingAgency ||
      profile.isTalentAgency ||
      profile.isFreelancer ||
      profile.isCompany;
    if (!hasType) missing.push('business_type');
    if (profile.isCompany && !profile.companySize) missing.push('company_size');
  }
  return missing;
}

function profileDto(p: InstanceType<typeof AdUserProfile> | null) {
  if (!p) return null;
  return {
    name: p.name ?? '',
    surnames: p.surnames ?? '',
    country: p.country ?? '',
    city: p.city ?? '',
    address: p.address ?? '',
    zipCode: p.zipCode ?? '',
    mobileNumber: p.mobileNumber ?? '',
    fiscalTaxesEeuu: !!p.fiscalTaxesEeuu,
    isMarketingAgency: !!p.isMarketingAgency,
    isTalentAgency: !!p.isTalentAgency,
    isFreelancer: !!p.isFreelancer,
    isCompany: !!p.isCompany,
    companySize: p.companySize ?? '',
  };
}

/* ---------------- VIP access request (Super Video's VERIFICATE) ---------------- */
/**
 * The Super Video card is VIP-only, and its dialog's one button asks the admin to open it.
 * The blade made that a `mailto:` — a broken one, with no domain — which does nothing at
 * all on a machine with no mail client, and even repaired it only fills in a draft the
 * advertiser still has to send. This sends the request, so the client actually receives it.
 *
 * Awaited rather than fired and forgotten, unlike the ad mails beside it: those ride along
 * with work that has already succeeded, while here the mail IS the work, and the advertiser
 * is told whether it went.
 */
adsRouter.post(
  '/vip-request',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = await User.findById(req.auth!.userId, { name: 1, email: 1, role: 1 }).lean();
    if (!me) throw ApiError.unauthorized();
    const mail = vipAccessRequestAdmin({
      userName: me.name ?? '',
      userEmail: me.email ?? '',
      role: me.role ?? 'user',
    });
    await sendMail(ADMIN_ADS_EMAIL, mail.subject, mail.html);
    res.json({ success: true, message: 'Request sent' });
  }),
);

/* ---------------- dashboard (index) ---------------- */
adsRouter.get(
  '/center',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = await User.findById(req.auth!.userId);
    if (!me) throw ApiError.unauthorized();
    const profile = await AdUserProfile.findOne({ user: me._id });
    res.json({
      success: true,
      adTypes: [...AD_TYPES],
      role: me.role,
      /* what the advertiser charges, so the create form's live preview can show the same
         button the feed will — Subscribe for a creator with a price, Follow otherwise */
      priceOfSubscription: me.priceOfSubscription ?? null,
      profile: profileDto(profile),
      missing: missingProfileFields(me.role, profile ? profileDto(profile) : null),
    });
  }),
);

/* ---------------- update advertiser profile ---------------- */
adsRouter.post(
  '/profile',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().max(255).optional(),
        surnames: z.string().max(255).optional(),
        country: z.string().max(255).optional(),
        city: z.string().max(255).optional(),
        address: z.string().max(255).optional(),
        zip_code: z.string().max(50).optional(),
        mobile_number: z.string().max(50).optional(),
        fiscal_taxes_eeuu: z.coerce.boolean().optional(),
        is_marketing_agency: z.coerce.boolean().optional(),
        is_talent_agency: z.coerce.boolean().optional(),
        is_freelancer: z.coerce.boolean().optional(),
        is_company: z.coerce.boolean().optional(),
        company_size: z.string().optional(),
      })
      .parse(req.body);

    const update = {
      name: body.name,
      surnames: body.surnames,
      country: body.country,
      city: body.city,
      address: body.address,
      zipCode: body.zip_code,
      mobileNumber: body.mobile_number,
      fiscalTaxesEeuu: !!body.fiscal_taxes_eeuu,
      isMarketingAgency: !!body.is_marketing_agency,
      isTalentAgency: !!body.is_talent_agency,
      isFreelancer: !!body.is_freelancer,
      isCompany: !!body.is_company,
      companySize: body.is_company ? body.company_size ?? null : null,
    };
    await AdUserProfile.updateOne(
      { user: req.auth!.userId },
      { $set: update, $setOnInsert: { user: req.auth!.userId } },
      { upsert: true },
    );
    res.json({ success: true });
  }),
);

/** Is an ad's artwork actually present? The same two folders `/assets/images` serves. */
function mediaOnDisk(media: string | null | undefined): boolean {
  const file = String(media ?? '').trim();
  if (!file) return false;
  /* a filename only — anything with a path separator is not ours to look up */
  if (/[/\\]/.test(file)) return false;
  const dirs = [path.resolve(env.UPLOADS_DIR)];
  if (env.LEGACY_ASSETS_DIR) dirs.push(path.resolve(env.LEGACY_ASSETS_DIR, 'images'));
  return dirs.some((d) => fs.existsSync(path.join(d, file)));
}

/* ---------------- every ad in the system, for the preview wall ----------------
   The World feed deals ads in among the posts a few at a time, so there is no way to see
   how each type of ad actually looks. This hands back all of them, newest first, in the
   shape the feed uses — the preview page then draws them with the very same tile.

   Unlike the feed it does not filter on approved/running: the point is to see everything
   that exists, including the rows migrated without a type. */
adsRouter.get(
  '/preview',
  requireAuth,
  asyncHandler(async (req, res) => {
    const all = await Ad.find(
      {},
      {
        media: 1, link: 1, adType: 1, user: 1, status: 1, approved: 1, createdAt: 1,
        buttonSize: 1, buttonPosition: 1,
      },
    )
      .sort({ createdAt: -1, mysqlId: -1 })
      .limit(400)
      .lean();

    /* An ad whose artwork is not on disk draws an empty frame, which is worse than not
       drawing it at all — the client asked for those to be left out. Every row in the
       database carries a filename; a third of them point at files that never came across
       in the migration, so the check has to be against the disk, not the field.
       The two folders are the same ones /assets/images is served from, newest first. */
    const ads = all.filter((a) => mediaOnDisk(a.media));
    const hidden = all.length - ads.length;

    /* the two profile-bound actions need the advertiser's handle */
    const ownerIds = ads
      .map((a) => a.user)
      .filter((u): u is NonNullable<typeof u> => !!u);
    const owners = await User.find(
      { _id: { $in: ownerIds } },
      /* role + price decide whether a profile-followers ad asks to be followed or
         subscribed to, the same test the feed and the profile make */
      { usernameUrl: 1, name: 1, profilePicture: 1, chatToggle: 1, role: 1, priceOfSubscription: 1 },
    ).lean();

    /* what this viewer already is to each advertiser */
    const [followed, subscribed] = await Promise.all([
      Followership.find(
        { followerUser: req.auth!.userId, followedUser: { $in: ownerIds } },
        { followedUser: 1 },
      ).lean().then((rows) => new Set(rows.map((r) => String(r.followedUser)))),
      Subscription.find(
        { user: req.auth!.userId, influencer: { $in: ownerIds } },
        { influencer: 1 },
      ).lean().then((rows) => new Set(rows.map((r) => String(r.influencer)))),
    ]);

    /* A Send Card writes to the advertiser's inbox, so it answers to the same rule the
       profile's ✉️ does: an advertiser who has set themselves Busy is behind the $10.
       Which of them this viewer has already paid is looked up once for the whole wall. */
    const paidTo = new Set(
      (
        await PremiumAccess.find(
          { user: req.auth!.userId, influencer: { $in: ownerIds } },
          { influencer: 1 },
        ).lean()
      ).map((r) => String(r.influencer)),
    );
    const byId = new Map(owners.map((u) => [String(u._id), u]));

    /* The three picker types carry `<app>/post/<id>` as their link; ads migrated from
       Laravel carry the old row number there instead, resolved through Post.mysqlId. */
    const previewRefs = ads.map((a) => {
      const href = a.link ?? '';
      const oid = /\/post\/([a-f0-9]{24})(?:[/?#]|$)/i.exec(href);
      if (oid) return { ad: String(a._id), id: oid[1] };
      const legacy = /\/post\/(\d+)(?:[/?#]|$)/.exec(href);
      return legacy ? { ad: String(a._id), mysqlId: Number(legacy[1]) } : { ad: String(a._id) };
    });
    const previewLegacy = [...new Set(previewRefs.map((r) => r.mysqlId).filter((n): n is number => !!n))];
    const previewLegacyMap = new Map<number, string>(
      previewLegacy.length
        ? (await Post.find({ mysqlId: { $in: previewLegacy } }, { mysqlId: 1 })
            .setOptions({ withMissing: true })
            .lean()).map((d) => [d.mysqlId as number, String(d._id)])
        : [],
    );
    const previewPostIds = new Map<string, string>();
    for (const r of previewRefs) {
      const id = r.id ?? (r.mysqlId ? previewLegacyMap.get(r.mysqlId) : undefined);
      if (id) previewPostIds.set(r.ad, id);
    }

    /* clients-form ads carry the advertiser's own wording for the button */
    const forms = await AdFormularyForm.find(
      { ad: { $in: ads.filter((a) => a.adType === 'clients-form').map((a) => a._id) } },
      { ad: 1, buttonAction: 1 },
    ).lean();
    const wording = new Map(forms.map((f) => [String(f.ad), f.buttonAction ?? null]));

    res.json({
      success: true,
      /* so the page can say how many it is not showing */
      hidden,
      total: all.length,
      ads: ads.map((a) => {
        const owner = a.user ? byId.get(String(a.user)) : undefined;
        return {
          id: String(a._id),
          adId: String(a._id),
          media: a.media ?? '',
          /* an old messages ad still holds a mailto: to its advertiser — their address is
             not the page's to publish, and the tile does not follow it anyway */
          link: /^mailto:/i.test(a.link ?? '') ? '' : a.link ?? '',
          adType: a.adType ?? null,
          status: !!a.status,
          approved: !!a.approved,
          buttonSize: a.buttonSize ?? 'medium',
          buttonPosition: a.buttonPosition ?? 'bottom',
          buttonAction: wording.get(String(a._id)) ?? null,
          advertiser: owner
            ? {
                /* the id is what a Send Card writes to */
                id: String(owner._id),
                usernameUrl: owner.usernameUrl ?? null,
                name: owner.name ?? null,
                profilePicture: owner.profilePicture ?? null,
                /* the two the tile needs to decide between writing and paying */
                chatToggle: owner.chatToggle !== false,
                viewerPremium: paidTo.has(String(owner._id)),
                role: owner.role ?? null,
                priceOfSubscription: owner.priceOfSubscription ?? null,
                viewerFollowing: followed.has(String(owner._id)),
                viewerSubscribed: subscribed.has(String(owner._id)),
              }
            : null,
          /* the post a picker ad promotes, so the creative opens it full screen */
          postId: previewPostIds.get(String(a._id)) ?? null,
        };
      }),
    });
  }),
);

/* ---------------- posts to promote (post picker) ---------------- */
/* Laravel's UserController::getUserPosts() pulls every post of the signed-in user, keeps only
   the still-image ones and then takes 200. The picker draws each tile in an <img>, so a video
   there could only ever be a broken thumbnail — hence the extension filter, mirrored here.
   One deliberate difference from Laravel: a hidden post is left out. Laravel still offered
   them, which is what David reported — a post taken off the profile was still on offer to
   promote, and reads to the owner as one they had deleted. */
const PICKER_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']);

adsRouter.get(
  '/posts',
  requireAuth,
  asyncHandler(async (req, res) => {
    const posts = await Post.find(
      { influencer: req.auth!.userId, visible: true },
      { imageVideo: 1 },
    )
      .sort({ createdAt: -1 })
      .lean();
    res.json({
      success: true,
      posts: posts
        .map((p) => ({ id: String(p._id), imageVideo: (p as { imageVideo?: string }).imageVideo ?? null }))
        .filter((p) => {
          const ext = p.imageVideo?.split('.').pop()?.toLowerCase() ?? '';
          return PICKER_IMAGE_EXTENSIONS.has(ext);
        })
        .slice(0, 200),
    });
  }),
);

/* ---------------- campaigns of a type ---------------- */
adsRouter.get(
  '/type/:type',
  requireAuth,
  asyncHandler(async (req, res) => {
    const type = String(req.params.type);
    if (!VALID_TYPES.has(type)) throw ApiError.notFound();
    await assertTypeAllowed(req.auth!.userId, type);
    const ads = await AdCampaign.find({ type: type as AdType, user: req.auth!.userId }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, type, ads: ads.map(campaignDto) });
  }),
);

/* ---------------- my ads (paid Ad records) ---------------- */
adsRouter.get(
  '/my-ads',
  requireAuth,
  asyncHandler(async (req, res) => {
    const ads = await Ad.find({ user: req.auth!.userId }).sort({ createdAt: -1 }).lean();
    const paidIds = new Set(
      (await AdPayment.find({ user: req.auth!.userId }, { ad: 1 }).lean()).map((p) => String(p.ad)),
    );
    res.json({ success: true, ads: ads.map((a) => ({ ...adDto(a), paid: paidIds.has(String(a._id)) })) });
  }),
);

/* ---------------- ads information (spent / remaining) ---------------- */
adsRouter.get(
  '/information',
  requireAuth,
  asyncHandler(async (req, res) => {
    const ads = await Ad.find({ user: req.auth!.userId }).sort({ createdAt: -1 }).lean();
    const rows = ads.map((a) => {
      const amount = a.amount ?? 0;
      const impressions = a.impressions ?? 0;
      const audience = AUDIENCE_MAP[a.adType ?? ''] ?? 100000;
      const costPerImpression = 1000 / audience;
      let spent = impressions * costPerImpression;
      if (spent > amount) spent = amount;
      return { ...adDto(a), media: a.media ?? null, spent: Math.round(spent * 100) / 100, remaining: Math.round((amount - spent) * 100) / 100 };
    });
    res.json({ success: true, ads: rows });
  }),
);

/* ---------------- potential clients (leads, business only) ---------------- */
adsRouter.get(
  '/potential-clients',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = await User.findById(req.auth!.userId, { role: 1 });
    if (me?.role !== 'business') {
      throw ApiError.forbidden('Only business accounts can access this page.');
    }
    const myAds = await Ad.find({ user: req.auth!.userId }, { _id: 1, media: 1, adType: 1, amount: 1 }).lean();
    const adById = new Map(myAds.map((a) => [String(a._id), a]));
    const forms = await AdFormularyForm.find({ ad: { $in: myAds.map((a) => a._id) } }, { _id: 1, ad: 1 }).lean();
    const formToAd = new Map(forms.map((f) => [String(f._id), String(f.ad)]));
    const leads = await AdFormularyLead.find({ form: { $in: forms.map((f) => f._id) } })
      .sort({ createdAt: -1 })
      .lean();
    res.json({
      success: true,
      leads: leads.map((l) => {
        const ad = adById.get(formToAd.get(String(l.form)) ?? '');
        return {
          id: String(l._id),
          name: l.name ?? '',
          email: l.email ?? '',
          phone: l.phone ?? '',
          company: l.company ?? '',
          answers: [l.answer1, l.answer2, l.answer3, l.answer4].filter(Boolean),
          createdAt: l.createdAt,
          media: ad?.media ?? null,
          adType: ad?.adType ?? '',
          amount: ad?.amount ?? 0,
        };
      }),
    });
  }),
);

/* ---------------- create ad: direct (no payment) or via payment ---------------- */
adsRouter.post(
  '/store/:type',
  requireAuth,
  asyncHandler(async (req, res) => {
    await assertTypeAllowed(req.auth!.userId, String(req.params.type));
    const { adId } = await buildAd(String(req.params.type), req.auth!.userId, req.body, 'active');
    res.json({ success: true, adId, message: 'campaign submitted' });
  }),
);

adsRouter.post(
  '/initiate-payment/:type',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!paymentProvider.ready) throw ApiError.badRequest('Payments are not configured');
    const amount = Number(req.body.amount);
    if (!amount || amount < 1) throw ApiError.badRequest('A valid amount is required');
    const me = await User.findById(req.auth!.userId);
    if (!me) throw ApiError.unauthorized();

    const { adId } = await buildAd(String(req.params.type), req.auth!.userId, req.body, 'draft');
    const { url } = await paymentProvider.createCheckout({
      mode: 'payment',
      amount,
      currency: CURRENCY,
      description: `Super Ads — ${req.params.type}`,
      customerEmail: me.email,
      metadata: { purpose: 'ads', userId: String(me._id), adId, amount: String(amount) },
      successUrl: `${APP}/super-ads/my-ads?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${APP}/super-ads?payment=cancelled`,
    });
    res.json({ success: true, url, adId });
  }),
);

/* ---------------- pay an existing (unpaid) ad ---------------- */
adsRouter.post(
  '/pay-existing',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!paymentProvider.ready) throw ApiError.badRequest('Payments are not configured');
    const { ad_id, amount } = z
      .object({ ad_id: z.string(), amount: z.coerce.number().positive() })
      .parse(req.body);
    const me = await User.findById(req.auth!.userId);
    if (!me) throw ApiError.unauthorized();
    const ad = await Ad.findOne({ _id: ad_id, user: me._id });
    if (!ad) throw ApiError.notFound('Ad not found');
    if (await AdPayment.exists({ ad: ad._id })) throw ApiError.badRequest('This ad has already been paid for.');

    const { url } = await paymentProvider.createCheckout({
      mode: 'payment',
      amount,
      currency: CURRENCY,
      description: `Super Ads Payment — Ad ${ad._id}`,
      customerEmail: me.email,
      metadata: { purpose: 'ads', userId: String(me._id), adId: String(ad._id), amount: String(amount) },
      successUrl: `${APP}/super-ads/my-ads?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${APP}/super-ads/my-ads?payment=cancelled`,
    });
    res.json({ success: true, url });
  }),
);

/* ---------------- show single campaign ---------------- */
adsRouter.get(
  '/campaign/:type/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const ad = await AdCampaign.findById(req.params.id);
    if (!ad || ad.type !== req.params.type) throw ApiError.notFound();
    if (String(ad.user) !== req.auth!.userId) throw ApiError.forbidden();
    const details = await AdCampaignDetail.find({ campaign: ad._id }).lean();
    res.json({
      success: true,
      ad: campaignDto(ad.toObject()),
      details: details.map((d) => ({ key: d.fieldKey, value: d.fieldValue })),
    });
  }),
);

/* ---------------- delete an ad ---------------- */
adsRouter.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const ad = await Ad.findById(req.params.id);
    if (!ad) throw ApiError.notFound();
    if (String(ad.user) !== req.auth!.userId) throw ApiError.forbidden();
    const hasPayment = await AdPayment.exists({ ad: ad._id });
    const isActive = ad.status === true;
    await ad.deleteOne();
    const message = hasPayment
      ? isActive
        ? "Ad canceled. You'll receive your money back in 48h. If the Ad has been ACTIVE, you'll receive the difference amount of wasted campaign, less taxes."
        : "Ad canceled. You'll receive your money back in 48h."
      : 'Ad cancelled successfully. Please try to be precise with your Ads, our team reviews manually the Ads, so this can be bothering for them.';
    res.json({ success: true, message });
  }),
);

/* ---------------- toggle a campaign's status (Stop / Play) ---------------- */
adsRouter.put(
  '/campaign/:id/toggle',
  requireAuth,
  asyncHandler(async (req, res) => {
    const campaign = await AdCampaign.findById(req.params.id);
    if (!campaign) throw ApiError.notFound();
    if (String(campaign.user) !== req.auth!.userId) throw ApiError.forbidden();
    campaign.status = campaign.status === 'active' ? 'stopped' : 'active';
    await campaign.save();
    res.json({ success: true, status: campaign.status, message: 'Ad status updated' });
  }),
);

/* ---------------- delete a campaign (type-page trash — ads.destroy) ---------------- */
adsRouter.delete(
  '/campaign/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const campaign = await AdCampaign.findById(req.params.id);
    if (!campaign) throw ApiError.notFound();
    if (String(campaign.user) !== req.auth!.userId) throw ApiError.forbidden();
    await AdCampaignDetail.deleteMany({ campaign: campaign._id });
    await campaign.deleteOne();
    res.json({ success: true, message: 'Ad deleted successfully' });
  }),
);

/* ---------------- formulary config (public — to render the lead form) ---------------- */
adsRouter.get(
  '/formulary/:adId',
  asyncHandler(async (req, res) => {
    const form = await AdFormularyForm.findOne({ ad: req.params.adId }).lean();
    if (!form) throw ApiError.notFound('Form not found');

    /* the mockups head every step of the formulary with the advertiser: their picture in a
       circle and the company they registered, so the viewer knows who is asking */
    const ad = await Ad.findById(form.ad, { user: 1, link: 1 }).lean();
    const advertiser = ad?.user
      ? await User.findById(ad.user, { name: 1, companyName: 1, profilePicture: 1 }).lean()
      : null;

    res.json({
      success: true,
      form: {
        adId: String(form.ad),
        title: form.title ?? '',
        company: advertiser?.companyName || advertiser?.name || '',
        avatar: advertiser?.profilePicture ?? null,
        website: ad?.link ?? '',
        askName: form.askName === 1,
        askEmail: form.askEmail === 1,
        askPhone: form.askPhone === 1,
        askCompany: form.askCompany === 1,
        questions: [form.question1, form.question2, form.question3, form.question4].filter(
          (q): q is string => !!q,
        ),
        buttonAction: form.buttonAction ?? 'More Info',
      },
    });
  }),
);

/* ---------------- lead capture (public) ---------------- */
adsRouter.post(
  '/formulary/:adId/lead',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const form = await AdFormularyForm.findOne({ ad: req.params.adId });
    if (!form) throw ApiError.notFound('Form not found');

    const b = req.body as Record<string, string>;
    // Conditional required validation mirrors submitLead().
    const requireField = (cond: boolean, val: string | undefined, name: string) => {
      if (cond && (!val || !val.trim())) throw ApiError.badRequest(`${name} is required.`);
    };
    requireField(form.askName === 1, b.name, 'Name');
    requireField(form.askEmail === 1, b.email, 'Email');
    requireField(form.askPhone === 1, b.phone, 'Phone');
    requireField(!!form.question1, b.answer1, 'Answer 1');
    requireField(!!form.question2, b.answer2, 'Answer 2');
    requireField(!!form.question3, b.answer3, 'Answer 3');
    requireField(!!form.question4, b.answer4, 'Answer 4');

    await AdFormularyLead.create({
      form: form._id,
      name: b.name,
      email: b.email,
      phone: b.phone,
      company: b.company,
      answer1: b.answer1,
      answer2: b.answer2,
      answer3: b.answer3,
      answer4: b.answer4,
    });
    res.json({ success: true, message: 'Lead submitted successfully.' });
  }),
);

/* ---------------- admin: all ads / approve / reject ---------------- */
adsRouter.get(
  '/all',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!(await isAdsAdmin(req.auth!.userId))) throw ApiError.forbidden();
    const ads = await Ad.find().sort({ createdAt: -1 }).populate('user', 'usernameUrl name email').lean();
    res.json({ success: true, ads: ads.map((a) => adDtoWithUser(a as unknown as Parameters<typeof adDtoWithUser>[0])) });
  }),
);

/** AdCenterController:542/566 mails the advertiser whenever an ad is approved
    or stopped. */
async function mailAdStatus(adId: string, approved: boolean): Promise<void> {
  const ad = await Ad.findById(adId, { mysqlId: 1, adType: 1, user: 1 }).lean();
  if (!ad?.user) return;
  const owner = await User.findById(ad.user, { name: 1, email: 1 }).lean();
  if (!owner?.email) return;
  const mail = adStatusChanged({
    name: owner.name ?? '',
    adId: ad.mysqlId ?? String(ad._id),
    adType: ad.adType ?? '',
    approved,
  });
  await sendMail(owner.email, mail.subject, mail.html).catch(() => undefined);
}

adsRouter.put(
  '/:id/approve',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!(await isAdsAdmin(req.auth!.userId))) throw ApiError.forbidden();
    await Ad.updateOne({ _id: req.params.id }, { $set: { approved: true, status: true } });
    void mailAdStatus(String(req.params.id), true);
    res.json({ success: true, message: 'Ad approved successfully.' });
  }),
);

adsRouter.put(
  '/:id/reject',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!(await isAdsAdmin(req.auth!.userId))) throw ApiError.forbidden();
    await Ad.updateOne({ _id: req.params.id }, { $set: { approved: false, status: false } });
    void mailAdStatus(String(req.params.id), false);
    res.json({ success: true, message: 'Ad marked as pending.' });
  }),
);

/**
 * Stop/Play an Ad (ads.update). The blade puts this button on My Ads as well as on the
 * all-ads table, and AdCenterController@update lets the ad's owner press it; the ads admin
 * keeps the same power so the moderation table still works. Activating requires approval.
 */
adsRouter.put(
  '/:id/toggle-status',
  requireAuth,
  asyncHandler(async (req, res) => {
    const ad = await Ad.findById(req.params.id);
    if (!ad) throw ApiError.notFound();
    const mine = String(ad.user) === req.auth!.userId;
    if (!mine && !(await isAdsAdmin(req.auth!.userId))) throw ApiError.forbidden();
    if (!ad.status && !ad.approved) {
      throw ApiError.badRequest('This ad is not approved yet. You cannot activate it.');
    }
    ad.status = !ad.status;
    await ad.save();
    res.json({ success: true, status: ad.status, message: 'Ad status updated' });
  }),
);

/* ================= helpers ================= */

function campaignDto(a: {
  _id: unknown;
  title: string;
  type: string;
  status: string;
  media?: string | null;
  objective?: string | null;
  budget: number;
  campaignDays?: number | null;
  approved?: number;
  createdAt?: Date;
}) {
  return {
    id: String(a._id),
    title: a.title,
    type: a.type,
    status: a.status,
    media: a.media ?? null,
    objective: a.objective ?? null,
    budget: a.budget,
    campaignDays: a.campaignDays ?? null,
    approved: a.approved ?? 0,
    createdAt: a.createdAt,
  };
}

function adDto(a: {
  _id: unknown;
  adType?: string;
  media?: string | null;
  link?: string | null;
  status: boolean;
  approved: boolean;
  amount?: number;
  impressions: number;
  clicks: number;
  country?: string | null;
  city?: string | null;
  createdAt?: Date;
}) {
  return {
    id: String(a._id),
    adType: a.adType ?? '',
    media: a.media ?? null,
    link: a.link ?? null,
    status: a.status,
    approved: a.approved,
    amount: a.amount ?? 0,
    impressions: a.impressions ?? 0,
    clicks: a.clicks ?? 0,
    country: a.country ?? null,
    city: a.city ?? null,
    createdAt: a.createdAt,
  };
}

function adDtoWithUser(a: Parameters<typeof adDto>[0] & { user?: { usernameUrl?: string; name?: string; email?: string } }) {
  return {
    ...adDto(a),
    user: a.user
      ? { usernameUrl: a.user.usernameUrl ?? '', name: a.user.name ?? '', email: a.user.email ?? '' }
      : null,
  };
}

/**
 * Port of storeAdInternal: derive title/media/link by type, create the AdCampaign + its
 * dynamic details, create the concrete Ad, and (for clients-form) its lead-capture form.
 * Returns the created ad id. `status` is 'active' for direct stores, 'draft' before payment.
 */
async function buildAd(
  type: string,
  userId: string,
  body: Record<string, unknown>,
  status: 'active' | 'draft',
): Promise<{ adId: string; campaignId: string }> {
  if (!VALID_TYPES.has(type)) throw ApiError.notFound();
  const t = type as AdType;

  const amount = Number(body.amount) || 0;
  const campaignDays = body.campaign_days ? Number(body.campaign_days) : null;
  const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

  let title = str(body.ad_name) || 'Untitled Ad';
  let mediaName: string | null = null;
  let link: string | null = null;

  const derivePost = async (): Promise<{ title: string; media: string | null; link: string }> => {
    const post = await Post.findById(str(body.post_id));
    if (!post) throw ApiError.badRequest('Post not found.');
    return {
      title: (post as unknown as { title?: string; caption?: string }).title ||
        ((post as unknown as { caption?: string }).caption ?? '').replace(/<[^>]+>/g, '').slice(0, 50) ||
        'Untitled Ad',
      media: (post as unknown as { imageVideo?: string }).imageVideo ?? null,
      link: `${APP}/post/${post._id}`,
    };
  };

  switch (t) {
    case 'promote-post': {
      const p = await derivePost();
      title = p.title;
      mediaName = p.media;
      link = p.link;
      break;
    }
    case 'profile-followers': {
      if (body.post_id) {
        const p = await derivePost();
        title = p.title;
        mediaName = p.media;
        link = p.link;
      } else {
        title = 'Follow Profile';
        const me = await User.findById(userId, { role: 1 });
        link = me?.role === 'user' ? `${APP}/user` : `${APP}/influencer`;
      }
      break;
    }
    case 'messages': {
      const p = await derivePost();
      title = p.title;
      mediaName = p.media;
      /* The card promises "message you in your SUPERWORLD inbox", so the button leads back
         into the app. It used to be `mailto:<the advertiser's own address>`, which did
         nothing in a browser with no mail client and published their address on a public
         page; the tile navigates to their profile instead. */
      const me = await User.findById(userId, { usernameUrl: 1 });
      link = me?.usernameUrl ? `${APP}/${me.usernameUrl}` : '';
      break;
    }
    case 'instagram':
      title = 'Instagram Ads';
      mediaName = 'blue24Instagram.png';
      link = `https://www.instagram.com/${str(body.instagram_url)}`;
      break;
    case 'tiktok':
      title = 'Tiktok Ads';
      mediaName = 'blue24Tiktok.png';
      link = `https://www.tiktok.com/@${str(body.tiktok_username)}`;
      break;
    case 'twitch':
      title = 'Twitch Ads';
      mediaName = 'blue24Twitch.png';
      link = `https://www.twitch.tv/${str(body.twitch_username)}`;
      break;
    case 'amazon':
      title = 'Amazon Ads';
      mediaName = 'blue24Twitch.png';
      link = str(body.amazon_url);
      break;
    case 'spotify':
      title = 'Spotify Ads';
      mediaName = 'blue24Twitch.png';
      link = str(body.spotify_url);
      break;
    case 'website-visits':
      title = 'Website Ads';
      mediaName = 'blue24Twitch.png';
      link = str(body.website_url);
      break;
    case 'calls':
      title = 'Phone Calls Ads';
      mediaName = 'blue24Twitch.png';
      link = `tel:${str(body.phone)}`;
      break;
    case 'whatsapp':
      title = 'Whatsapp Ads';
      mediaName = 'blue24Twitch.png';
      link = `https://wa.me/${str(body.phone)}`;
      break;
    case 'youtube': {
      title = 'YouTube Ads';
      mediaName = 'blue24Twitch.png';
      const value = str(body.youtube_username).trim();
      link = /^UC[a-zA-Z0-9_-]{22}$/.test(value)
        ? `https://www.youtube.com/channel/${value}`
        : `https://www.youtube.com/@${value.replace(/^@/, '')}`;
      break;
    }
    default:
      break;
  }

  // Uploaded media (base64 data URL) overrides the type default.
  if (typeof body.media === 'string' && body.media.startsWith('data:')) {
    mediaName = await saveBase64Media(body.media);
  }

  /* The Ads Center's type page sends the advertiser's own title and destination, the way
     AdCenterController@store takes them; the payment path sends neither and keeps the
     derived defaults set above. */
  if (str(body.title)) title = str(body.title);
  if (str(body.link)) link = str(body.link);

  const campaign = await AdCampaign.create({
    title,
    type: t,
    user: userId,
    status,
    media: mediaName,
    objective: str(body.ad_name) || null,
    budget: amount,
    campaignDays,
  });

  // Save dynamic detail fields (everything except the reserved ones).
  const ignore = new Set(['_token', 'ad_name', 'media', 'post_id', 'amount', 'payment_type', 'campaign_days']);
  for (const [key, value] of Object.entries(body)) {
    if (ignore.has(key)) continue;
    if (value === null || value === '' || value === 'null' || value === undefined) continue;
    await AdCampaignDetail.create({
      campaign: campaign._id,
      fieldKey: key,
      fieldValue: typeof value === 'object' ? JSON.stringify(value) : String(value),
    });
  }
  if (body.post_id) {
    await AdCampaignDetail.create({ campaign: campaign._id, fieldKey: 'post_id', fieldValue: str(body.post_id) });
  }

  /* ids in this collection are the migrated MySQL ones, and the owner's Ad
     Management panel prints them as the ID column; a row created here keeps the
     run going rather than landing without one. */
  const highestAd = await Ad.findOne({}, { mysqlId: 1 }).sort({ mysqlId: -1 }).lean();

  /* the two the advertiser sets on the form; anything else falls back to the drawn default */
  const SIZES = ['small', 'medium', 'large'] as const;
  const POSITIONS = ['top', 'center', 'bottom'] as const;
  type BtnSize = (typeof SIZES)[number];
  type BtnPos = (typeof POSITIONS)[number];
  const rawSize = str(body.button_size) as BtnSize;
  const rawPos = str(body.button_position) as BtnPos;
  const buttonSize: BtnSize = SIZES.includes(rawSize) ? rawSize : 'medium';
  const buttonPosition: BtnPos = POSITIONS.includes(rawPos) ? rawPos : 'bottom';

  const ad = await Ad.create({
    mysqlId: (highestAd?.mysqlId ?? 0) + 1,
    user: userId,
    adType: t,
    media: mediaName ?? undefined,
    link: link ?? undefined,
    buttonSize,
    buttonPosition,
    status: false,
    approved: false,
    amount,
    impressions: 0,
    clicks: 0,
    country: str(body.country) || undefined,
    city: str(body.city) || undefined,
  });

  if (t === 'clients-form') {
    await AdFormularyForm.create({
      ad: ad._id,
      title: str(body.ad_name),
      question1: str(body.question1),
      question2: str(body.question2) || undefined,
      question3: str(body.question3) || undefined,
      question4: str(body.question4) || undefined,
      askName: body.ask_name ? 1 : 0,
      askEmail: body.ask_email ? 1 : 0,
      askCompany: body.ask_company ? 1 : 0,
      askPhone: body.ask_phone ? 1 : 0,
      buttonAction: str(body.button_action),
      country: str(body.country),
      city: str(body.city),
    });
  }

  /* AdsPaymentController:771 mails both the advertiser and the admin the moment
     an ad is submitted. Failures are swallowed: a mail server being down must
     not lose the ad that was just created. */
  const advertiser = await User.findById(userId, { name: 1, email: 1 }).lean();
  if (advertiser) {
    const forUser = adCreatedUser({ name: advertiser.name ?? '', adType: t, amount });
    void sendMail(advertiser.email ?? '', forUser.subject, forUser.html).catch(() => undefined);

    const forAdmin = adCreatedAdmin({
      adType: t,
      amount,
      userName: advertiser.name ?? '',
      userEmail: advertiser.email ?? '',
    });
    void sendMail(ADMIN_ADS_EMAIL, forAdmin.subject, forAdmin.html).catch(() => undefined);
  }

  return { adId: String(ad._id), campaignId: String(campaign._id) };
}
