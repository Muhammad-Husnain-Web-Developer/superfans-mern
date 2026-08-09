import { Schema, model, Types } from 'mongoose';

/**
 * Admin-managed entities (mirror the MySQL tables behind the Laravel admin panel):
 *  - Coupon: discount codes
 *  - Package + PackageInclude: subscription packages and their feature flags
 *  - Modal: a merch/avatar product (name, price, icon, image)
 *  - Asset: an avatar-customization asset (icon/overlay with a z-index and parent)
 *  - WaterMark: an uploaded watermark image
 *  - Cart: a merch order (avatar part slots + payment status)
 */

/* ---------------- Coupon ---------------- */
export interface ICoupon {
  name?: string;
  code?: string;
  amount: number;
  type?: string; // 'percentage' | 'fixed'
  expiryDate?: string;
  limitOne?: number;
  mysqlId?: number;
  createdAt: Date;
  updatedAt: Date;
}
const couponSchema = new Schema<ICoupon>(
  {
    name: String,
    code: { type: String, index: true },
    amount: { type: Number, default: 0 },
    type: String,
    expiryDate: String,
    limitOne: { type: Number, default: 0 },
    mysqlId: { type: Number, unique: true, sparse: true },
  },
  { timestamps: true },
);
export const Coupon = model<ICoupon>('Coupon', couponSchema);

/* ---------------- Package + includes ---------------- */
export interface IPackage {
  name?: string;
  price?: number;
  desc?: string;
  duration?: number;
  durationUnit?: string;
  mysqlId?: number;
}
const packageSchema = new Schema<IPackage>(
  {
    name: String,
    price: Number,
    desc: String,
    duration: Number,
    durationUnit: String,
    mysqlId: { type: Number, unique: true, sparse: true },
  },
  { timestamps: true },
);
export const Package = model<IPackage>('Package', packageSchema);

export interface IPackageInclude {
  package: Types.ObjectId;
  available?: string;
  unlimited?: string;
  twentyFourHourFree?: string;
  free?: string;
  mysqlId?: number;
}
const packageIncludeSchema = new Schema<IPackageInclude>(
  {
    package: { type: Schema.Types.ObjectId, ref: 'Package', index: true },
    available: String,
    unlimited: String,
    twentyFourHourFree: String,
    free: String,
    mysqlId: { type: Number, unique: true, sparse: true },
  },
  { timestamps: true },
);
export const PackageInclude = model<IPackageInclude>('PackageInclude', packageIncludeSchema);

/* ---------------- Modal (merch/avatar product) ---------------- */
export interface IModal {
  name?: string;
  price?: number;
  icon?: string;
  image?: string;
  mysqlId?: number;
  createdAt: Date;
  updatedAt: Date;
}
const modalSchema = new Schema<IModal>(
  {
    name: String,
    price: Number,
    icon: String,
    image: String,
    mysqlId: { type: Number, unique: true, sparse: true },
  },
  { timestamps: true },
);
export const Modal = model<IModal>('Modal', modalSchema);

/* ---------------- Asset ---------------- */
export interface IAsset {
  name?: string;
  parent?: number;
  icon?: string;
  iconOff?: string;
  image?: string;
  zIndex?: number;
  mysqlId?: number;
}
const assetSchema = new Schema<IAsset>(
  {
    name: String,
    parent: Number,
    icon: String,
    iconOff: String,
    image: String,
    zIndex: { type: Number, default: 0 },
    mysqlId: { type: Number, unique: true, sparse: true },
  },
  { timestamps: true },
);
export const Asset = model<IAsset>('Asset', assetSchema);

/* ---------------- WaterMark ---------------- */
export interface IWaterMark {
  image?: string;
  mysqlId?: number;
  createdAt: Date;
  updatedAt: Date;
}
const waterMarkSchema = new Schema<IWaterMark>(
  {
    image: String,
    mysqlId: { type: Number, unique: true, sparse: true },
  },
  { timestamps: true },
);
export const WaterMark = model<IWaterMark>('WaterMark', waterMarkSchema);

/* ---------------- Cart (merch order) ---------------- */
export interface ICart {
  user?: Types.ObjectId;
  modal?: Types.ObjectId;
  glasses?: number;
  mask?: number;
  shoes?: number;
  vest?: number;
  helmet?: number;
  headphone?: number;
  gloves?: number;
  paymentStatus: number;
  // Merch-catalogue orders (the live merch is a fixed catalogue, not Modal rows):
  productSlug?: string;
  productName?: string;
  productPrice?: number;
  buyerEmail?: string;
  reference?: string; // gateway session/reference
  referredInfluencer?: Types.ObjectId;
  mysqlId?: number;
  createdAt: Date;
  updatedAt: Date;
}
const cartSchema = new Schema<ICart>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    modal: { type: Schema.Types.ObjectId, ref: 'Modal' },
    glasses: Number,
    mask: Number,
    shoes: Number,
    vest: Number,
    helmet: Number,
    headphone: Number,
    gloves: Number,
    paymentStatus: { type: Number, default: 0, index: true },
    productSlug: String,
    productName: String,
    productPrice: Number,
    buyerEmail: String,
    reference: { type: String, index: true },
    referredInfluencer: { type: Schema.Types.ObjectId, ref: 'User' },
    mysqlId: { type: Number, unique: true, sparse: true },
  },
  { timestamps: true },
);
export const Cart = model<ICart>('Cart', cartSchema);
