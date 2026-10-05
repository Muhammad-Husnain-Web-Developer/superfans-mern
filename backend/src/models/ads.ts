import { Schema, model, Types } from 'mongoose';

/**
 * Ads Center models (mirror the MySQL tables behind the Super-Ads module):
 *  - AdUserProfile: the advertiser's billing/agency profile (gate before creating ads)
 *  - AdCampaign + AdCampaignDetail: the campaign record with dynamic key/value details
 *  - Ad: the concrete ad (with link, type, approval, impressions/clicks) shown to viewers
 *  - AdFormularyForm + AdFormularyLead: the clients-form lead-capture form and its leads
 *  - AdPayment: a recorded payment against an Ad
 */

export const AD_TYPES = [
  'promote-post',
  'profile-followers',
  'clients-form',
  'messages',
  'instagram',
  'tiktok',
  'twitch',
  'youtube',
  'spotify',
  'amazon',
  'aliexpress-temu',
  'ecommerce',
  'calls',
  'whatsapp',
  'website-visits',
] as const;
export type AdType = (typeof AD_TYPES)[number];

/* ---------------- AdUserProfile ---------------- */
export interface IAdUserProfile {
  user: Types.ObjectId;
  name?: string;
  surnames?: string;
  country?: string;
  city?: string;
  address?: string;
  zipCode?: string;
  mobileNumber?: string;
  fiscalTaxesEeuu?: boolean;
  isMarketingAgency?: boolean;
  isTalentAgency?: boolean;
  isFreelancer?: boolean;
  isCompany?: boolean;
  companySize?: string;
  mysqlId?: number;
}
const adUserProfileSchema = new Schema<IAdUserProfile>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    name: String,
    surnames: String,
    country: String,
    city: String,
    address: String,
    zipCode: String,
    mobileNumber: String,
    fiscalTaxesEeuu: { type: Boolean, default: false },
    isMarketingAgency: { type: Boolean, default: false },
    isTalentAgency: { type: Boolean, default: false },
    isFreelancer: { type: Boolean, default: false },
    isCompany: { type: Boolean, default: false },
    companySize: String,
    mysqlId: { type: Number, unique: true, sparse: true },
  },
  { timestamps: true },
);
export const AdUserProfile = model<IAdUserProfile>('AdUserProfile', adUserProfileSchema);

/* ---------------- AdCampaign ---------------- */
export interface IAdCampaign {
  title: string;
  type: AdType;
  status: string; // 'active' | 'draft'
  media?: string | null;
  objective?: string | null;
  budget: number;
  campaignDays?: number | null;
  user: Types.ObjectId;
  approved?: number;
  mysqlId?: number;
  createdAt: Date;
  updatedAt: Date;
}
const adCampaignSchema = new Schema<IAdCampaign>(
  {
    title: { type: String, required: true },
    type: { type: String, required: true, index: true },
    status: { type: String, default: 'active' },
    media: { type: String, default: null },
    objective: { type: String, default: null },
    budget: { type: Number, default: 0 },
    campaignDays: { type: Number, default: null },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    approved: { type: Number, default: 0 },
    mysqlId: { type: Number, unique: true, sparse: true },
  },
  { timestamps: true },
);
export const AdCampaign = model<IAdCampaign>('AdCampaign', adCampaignSchema);

/* ---------------- AdCampaignDetail ---------------- */
export interface IAdCampaignDetail {
  campaign: Types.ObjectId;
  fieldKey: string;
  fieldValue: string;
  mysqlId?: number;
}
const adCampaignDetailSchema = new Schema<IAdCampaignDetail>(
  {
    campaign: { type: Schema.Types.ObjectId, ref: 'AdCampaign', required: true, index: true },
    fieldKey: { type: String, required: true },
    fieldValue: { type: String, default: '' },
    mysqlId: { type: Number, unique: true, sparse: true },
  },
  { timestamps: true },
);
export const AdCampaignDetail = model<IAdCampaignDetail>('AdCampaignDetail', adCampaignDetailSchema);

/* ---------------- Ad ----------------
 * The concrete `ads` row is already modelled in ./Ad.ts (used by the sidebar/feed in
 * world.routes). Reuse that single registration here so the Ads Center and the feed
 * share one model (status/approved are booleans there). */
export { Ad, type IAd } from './Ad.js';

/* ---------------- AdFormularyForm ---------------- */
export interface IAdFormularyForm {
  ad: Types.ObjectId;
  title?: string;
  question1?: string;
  question2?: string;
  question3?: string;
  question4?: string;
  askName: number;
  askEmail: number;
  askCompany: number;
  askPhone: number;
  buttonAction?: string;
  country?: string;
  city?: string;
  mysqlId?: number;
}
const adFormularyFormSchema = new Schema<IAdFormularyForm>(
  {
    ad: { type: Schema.Types.ObjectId, ref: 'Ad', required: true, index: true },
    title: String,
    question1: String,
    question2: String,
    question3: String,
    question4: String,
    askName: { type: Number, default: 0 },
    askEmail: { type: Number, default: 0 },
    askCompany: { type: Number, default: 0 },
    askPhone: { type: Number, default: 0 },
    buttonAction: String,
    country: String,
    city: String,
    mysqlId: { type: Number, unique: true, sparse: true },
  },
  { timestamps: true },
);
export const AdFormularyForm = model<IAdFormularyForm>('AdFormularyForm', adFormularyFormSchema);

/* ---------------- AdFormularyLead ---------------- */
export interface IAdFormularyLead {
  form: Types.ObjectId;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  answer1?: string;
  answer2?: string;
  answer3?: string;
  answer4?: string;
  mysqlId?: number;
  createdAt: Date;
  updatedAt: Date;
}
const adFormularyLeadSchema = new Schema<IAdFormularyLead>(
  {
    form: { type: Schema.Types.ObjectId, ref: 'AdFormularyForm', required: true, index: true },
    name: String,
    email: String,
    phone: String,
    company: String,
    answer1: String,
    answer2: String,
    answer3: String,
    answer4: String,
    mysqlId: { type: Number, unique: true, sparse: true },
  },
  { timestamps: true },
);
export const AdFormularyLead = model<IAdFormularyLead>('AdFormularyLead', adFormularyLeadSchema);

/* ---------------- AdPayment ---------------- */
export interface IAdPayment {
  user: Types.ObjectId;
  ad: Types.ObjectId;
  amount: number;
  method: string;
  mysqlId?: number;
  createdAt: Date;
  updatedAt: Date;
}
const adPaymentSchema = new Schema<IAdPayment>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ad: { type: Schema.Types.ObjectId, ref: 'Ad', required: true, index: true },
    amount: { type: Number, default: 0 },
    method: { type: String, default: 'stripe' },
    mysqlId: { type: Number, unique: true, sparse: true },
  },
  { timestamps: true },
);
export const AdPayment = model<IAdPayment>('AdPayment', adPaymentSchema);
