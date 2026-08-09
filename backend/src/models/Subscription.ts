import { Schema, model, type Types } from 'mongoose';

/** Paid subscription fan→creator (mirrors MySQL `subscriptions`). */
export interface ISubscription {
  user: Types.ObjectId;
  influencer?: Types.ObjectId;
  amount: number;
  plan: 'monthly' | 'quinzenal';
  nextPaymentAt?: Date;
  /** Payment provider + its subscription id, so any gateway can be reconciled. */
  provider?: string;
  externalId?: string;
  status?: 'active' | 'cancelled';
  mysqlId?: number;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<ISubscription>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    influencer: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    amount: { type: Number, required: true },
    plan: { type: String, enum: ['monthly', 'quinzenal'], default: 'monthly' },
    nextPaymentAt: Date,
    provider: String,
    externalId: { type: String, index: true, sparse: true },
    status: { type: String, enum: ['active', 'cancelled'], default: 'active' },
    mysqlId: { type: Number, unique: true, sparse: true },
  },
  { timestamps: true },
);

export const Subscription = model<ISubscription>('Subscription', subscriptionSchema);
