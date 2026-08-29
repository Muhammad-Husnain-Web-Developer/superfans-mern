import { Schema, model, type Types } from 'mongoose';

/** Sidebar/feed ad (mirrors MySQL `ads`). */
export interface IAd {
  user?: Types.ObjectId;
  adType?: string;
  media?: string | null;
  link?: string;
  /** How big the call-to-action is drawn on the creative, and where on it. The advertiser
   *  picks both when the ad is created; older rows have neither and fall back to the
   *  figures measured off the client's own cards (medium, at the foot). */
  buttonSize?: 'small' | 'medium' | 'large';
  buttonPosition?: 'top' | 'center' | 'bottom';
  status: boolean;
  approved: boolean;
  amount?: number;
  impressions: number;
  clicks: number;
  country?: string;
  city?: string;
  mysqlId?: number;
  createdAt: Date;
  updatedAt: Date;
}

const adSchema = new Schema<IAd>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    adType: String,
    media: { type: String, default: null },
    link: String,
    buttonSize: { type: String, enum: ['small', 'medium', 'large'], default: 'medium' },
    buttonPosition: { type: String, enum: ['top', 'center', 'bottom'], default: 'bottom' },
    status: { type: Boolean, default: false, index: true },
    approved: { type: Boolean, default: false },
    amount: Number,
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    country: String,
    city: String,
    mysqlId: { type: Number, unique: true, sparse: true },
  },
  { timestamps: true },
);

export const Ad = model<IAd>('Ad', adSchema);
