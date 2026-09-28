import { Schema, model, type Types } from 'mongoose';

/**
 * A business account asking an influencer or user to link their accounts.
 *
 * There is no Laravel original for this — the whole notion is the client's (28 Sep 2026):
 * "Only Business Accounts can do it. They send a solicitude to Influencers/Users for
 * vinculate accounts." What an accepted link then *permits* — the business managing that
 * account's ads and posting to its profile — is a separate piece of work and deliberately
 * not modelled here yet. This row only records that the ask was made and how it was answered,
 * which is what the notification panel needs.
 */
export interface IPartnerRequest {
  /** the business account doing the asking */
  business: Types.ObjectId;
  /** the influencer or user being asked */
  target: Types.ObjectId;
  status: 'pending' | 'accepted' | 'declined';
  /** when the target answered; absent while it is still pending */
  respondedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const partnerRequestSchema = new Schema<IPartnerRequest>(
  {
    business: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    target: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending', index: true },
    respondedAt: { type: Date },
  },
  { timestamps: true },
);

/* One live ask per pair: a business that has already asked should not be able to stack
   requests on the same account, and the panel would show the same row twice. A pair may
   appear again once the first was answered, so this is not a plain unique index. */
partnerRequestSchema.index(
  { business: 1, target: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
);

export const PartnerRequest = model<IPartnerRequest>('PartnerRequest', partnerRequestSchema);
