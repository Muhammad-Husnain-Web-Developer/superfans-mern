import { Schema, model, type Types } from 'mongoose';

/**
 * A fan's paid priority access to one creator's inbox — the blade's "premium fan".
 *
 * user_profile.blade.php:1310-1345 puts a creator who has switched their chat off behind a
 * $10 one-off: the ✉️ button raises "Super Busy!", then "🏅 Priority Access – $10", and the
 * payment lets that fan write to them anyway. Laravel checks it with `hasPaidInfluencer`;
 * one row here is that check.
 *
 * It is a one-off, not a subscription — the blade's own words: "This premium subscription
 * won't be renewed next month, don't worry! It's only for 1 use." Paying twice for the same
 * creator is therefore pointless, so the pair is unique.
 */
export interface IPremiumAccess {
  user: Types.ObjectId;
  influencer: Types.ObjectId;
  /** what was actually charged, in the currency of the checkout */
  amount: number;
  /** the Stripe session, so a webhook replay cannot record the same payment twice */
  sessionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const premiumAccessSchema = new Schema<IPremiumAccess>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    influencer: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, default: 10 },
    sessionId: { type: String, unique: true, sparse: true },
  },
  { timestamps: true },
);

/* one fan, one creator, one payment */
premiumAccessSchema.index({ user: 1, influencer: 1 }, { unique: true });

export const PremiumAccess = model<IPremiumAccess>('PremiumAccess', premiumAccessSchema);
