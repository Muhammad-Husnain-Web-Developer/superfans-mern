import { Schema, model, type Types } from 'mongoose';

/**
 * A rule the owner writes over the reach the ladder works out — the two "lockers" the client
 * asked for on his admin panel.
 *
 * `zone` — posts made in one place, shown in another: "Country Zone Post Locker".
 * `user` — one account's posts, shown in a place: "User Individual Locker Country".
 *
 * A place is a country and, when the rule is meant for one region only — the client named
 * Catalunya — the region inside it. Left blank, the rule covers the whole country. Cities he
 * withdrew himself.
 *
 * The figure is the last word where the rule matches: 0 shuts the door and 100 opens it, and
 * anything between is read the way every other reach figure is, as each post's chance of
 * appearing there. Nothing here is computed; it exists only because somebody wrote it.
 */
export interface LockPlace {
  /** ISO-3166 alpha-2 */
  country: string;
  /** ISO-3166-2 region code inside it, e.g. `CT` — null for the whole country */
  region?: string | null;
}

export interface IReachLock {
  kind: 'zone' | 'user';
  /** the account the rule is about — `user` rules only */
  user?: Types.ObjectId | null;
  /** where the posts were made — `zone` rules only */
  from?: LockPlace | null;
  /** where the posts are shown */
  to: LockPlace;
  /** 0-100 */
  percent: number;
  createdAt: Date;
  updatedAt: Date;
}

const placeSchema = new Schema<LockPlace>(
  {
    country: { type: String, required: true },
    region: { type: String, default: null },
  },
  { _id: false },
);

const reachLockSchema = new Schema<IReachLock>(
  {
    kind: { type: String, enum: ['zone', 'user'], required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    from: { type: placeSchema, default: null },
    to: { type: placeSchema, required: true },
    percent: { type: Number, required: true, min: 0, max: 100 },
  },
  { timestamps: true },
);

/* one rule per pairing — writing the same pairing again changes its figure rather than
   leaving two rules to disagree over which applies */
reachLockSchema.index(
  { kind: 1, user: 1, 'from.country': 1, 'from.region': 1, 'to.country': 1, 'to.region': 1 },
  { unique: true },
);

export const ReachLock = model<IReachLock>('ReachLock', reachLockSchema);
