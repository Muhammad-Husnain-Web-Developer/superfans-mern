import { Schema, model, type Types } from 'mongoose';

/** Sidebar/feed ad (mirrors MySQL `ads`). */
export interface IAd {
  user?: Types.ObjectId;
  adType?: string;
  media?: string | null;
  link?: string;
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
