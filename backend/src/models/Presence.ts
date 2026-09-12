import { Schema, model, type Types } from 'mongoose';

/**
 * One row for each day an account was seen in a country.
 *
 * This is what the client's ladder counts. He set the test himself: somebody must not be able
 * to "be 15 days with 14 days without login, and post 45 videos in 1 day". Counting days of
 * *presence* rather than days on the calendar is what makes that impossible — a day only
 * exists here if the account was actually opened from that country on it, so posting forty-five
 * times in one sitting still earns exactly one day.
 *
 * A row is never updated, only created, and the index below is what keeps it to one per day:
 * `trackPresence` attempts an insert on every sighting and the duplicate is discarded.
 *
 * The day is the UTC date. A traveller crossing a timezone at midnight may have a day land on
 * one side or the other of what their own clock says; over the 5, 15 and 38-day thresholds the
 * client set, that is not a difference worth carrying a per-user timezone for.
 */
export interface IPresence {
  user: Types.ObjectId;
  /** ISO-3166 alpha-2 */
  country: string;
  /** the region they were in that day — the first one seen, for the region-level lockers */
  region?: string | null;
  /** UTC midnight of the day, so a day is one value rather than a range to scan */
  day: Date;
  createdAt: Date;
}

const presenceSchema = new Schema<IPresence>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    country: { type: String, required: true },
    region: { type: String, default: null },
    day: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

/* one row per account per country per day — and the same index answers "how many days has
   this account been in that country", which is the question the ladder asks */
presenceSchema.index({ user: 1, country: 1, day: 1 }, { unique: true });

export const Presence = model<IPresence>('Presence', presenceSchema);

/** UTC midnight of whatever moment is given — the value stored in `day`. */
export function utcDay(when: Date = new Date()): Date {
  return new Date(Date.UTC(when.getUTCFullYear(), when.getUTCMonth(), when.getUTCDate()));
}
