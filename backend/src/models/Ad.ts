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
  /** `outside` is the odd one of the four: the other three stand the button ON the creative,
   *  this one puts it under the tile at the right, where a post carries its rating pill. The
   *  create form locks the size to `small` when it is chosen (David, 4 Oct 2026). */
  buttonPosition?: 'top' | 'center' | 'bottom' | 'outside';
  /** Which of a type's button designs the advertiser ticked — `itunes`/`spotify` on a
   *  spotify ad, `amazon-yellow`/`amazon-white`/`amazon-mono` on an amazon one. Unset on
   *  every other type, and on older rows, which draw the type's first design. */
  buttonVariant?: string;
  /** The advertiser's own logo and @handle beside the "Super Ads" label, on WORLD and the
   *  walls — the double tag David asked for (4 Oct 2026). Off unless the advertiser ticks the
   *  box on the create form, so every ad already bought keeps the single tag it has. The
   *  full-screen viewer ignores it: there the handle is in the bottom bar already. */
  showAdvertiserTag?: boolean;
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
    buttonPosition: { type: String, enum: ['top', 'center', 'bottom', 'outside'], default: 'bottom' },
    buttonVariant: String,
    showAdvertiserTag: { type: Boolean, default: false },
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
