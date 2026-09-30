import { Schema, model, type Document, type Model } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole = 'user' | 'influencer' | 'business' | 'admin';
/* 'deleted' is a state, not a removal: InfluencerController::deleteUser flips the
   column and offers Restore beside it, so nothing is ever taken off the table. */
export type UserStatus = 'active' | 'suspended' | 'deleted';

/**
 * ESTADO — what the dot beside an @nickname shows. Distinct from UserStatus above:
 * that one is whether the account may log in at all, this one is what other readers
 * see while it is logged in.
 */
export type UserPresence = 'online' | 'away' | 'disconnected';

export interface IUser extends Document {
  // Identity
  name: string;
  surname?: string;
  email: string;
  password: string;
  role: UserRole;
  status: UserStatus;
  usernameUrl?: string;
  emailVerifiedAt?: Date;
  acceptedTermsAndConditions: boolean;

  // Profile
  bio?: string;
  profilePicture?: string;
  coverPicture?: string;
  coverColor: string;
  footerNameUsername?: string;
  profilePictureBorderStatus?: string;
  birth?: string;
  country?: string;
  gender?: string;
  nationality?: string;
  number?: string;
  phone?: string;
  categories: string[];
  /**
   * INTERESTS — what this reader wants their WORLD feed built from, chosen on the
   * screen that follows registration (David, 30 Sep 2026).
   *
   * Deliberately its own field rather than a second use of `categories` above: that
   * one is a creator's own subject matter, picked in the register form and shown on
   * their profile. These are the opposite direction — what somebody wants to be
   * shown — and a fan who creates nothing still has them.
   *
   * Stored as stable slugs ('football', 'popular_girls'), never as the label the
   * reader saw. The labels are translated into ten languages, so storing them would
   * leave a Spanish account's 'Fútbol' and an English one's 'Football' as two
   * different interests, and the feed filter David is planning could not match them.
   */
  interests: string[];

  // Social networks (CSV columns in Laravel → arrays here)
  networks: string[];
  networkProfileLinks: string[];
  instagramLink?: string;
  referredInfluencer?: string;

  // Business accounts
  dni?: string;
  companyName?: string;
  companyId?: string;
  address?: string;

  // Creator / payments
  priceOfSubscription?: number;
  bankAccount?: string;
  paypalAccount?: string;
  earnings: number;
  /** what the creator has been paid for Super Video ads — shown as its own line in the
      control panel, set by hand from the admin table. Kept beside `earnings` rather than
      inside it: the total is what a withdrawal draws on, and this is a breakdown. */
  videoAdsEarnings: number;
  externalCustomerId?: string;

  // Engagement & growth engine
  noOfFollowers: number;
  growthStatus?: string;
  growthGearLevel?: number;
  growthStartTime?: Date;
  followerGrowthTime?: Date;
  vip: boolean;
  verified: boolean;
  /** Redsys: the order id + purpose of an in-flight payment, applied on notification */
  pendingRedsysOrder?: string;
  pendingRedsysPurpose?: string;
  chatToggle: boolean;
  notificationsSeenAt?: Date;
  /**
   * SOUND EFFECTS — the account-wide toggle that gates every button sound in the
   * app (the network slider's arrows, the like and hate on every wall). On by
   * default, so an account that has never touched it behaves exactly as before.
   */
  soundEffects: boolean;
  /**
   * ESTADO — the presence the account shows other people: the green/red/yellow dot
   * beside its @nickname. Deliberately NOT `status` above, which is the account's
   * standing (active / suspended / deleted) and is what the login checks.
   *
   * The client asked (30 Sep 2026) for it to reset to `online` on every login, so it
   * is a live presence the reader can override for the session rather than a lasting
   * preference. Nothing expires it: `away` and `disconnected` are chosen, and stay
   * until the reader changes them or logs in again.
   */
  presence: UserPresence;

  // Geo tracking
  registeredIp?: string;
  registeredCountry?: string;
  visitedCountries: string[];

  /**
   * The two the client asks us to keep apart.
   *
   * `usual` is where they live. It only moves after 38 days in another country, and the one
   * it moved from is never thrown away — `visitedCountries` above keeps every country this
   * account has ever been seen in.
   *
   * `current` is where they were the last time they opened the app. It follows them at once,
   * and going home puts `usual` back on the first day.
   *
   * Both are absent until an address places them; the `country` field near the top of this
   * model is a different thing — what the person typed on the register form.
   */
  usual?: {
    country: string;
    region?: string | null;
    /** when this became their usual country, so a move can be told from the original */
    since?: Date | null;
  } | null;
  current?: {
    country: string;
    region?: string | null;
    city?: string | null;
    lat?: number | null;
    lng?: number | null;
    /** the last time an address put them here — how `current` is known to be current */
    seenAt: Date;
  } | null;
  /**
   * Every country that has been this account's usual one, oldest first, the one they hold now
   * included. The client's rule needs the order, not just the set: "the OLD COUNTRY always
   * appear at his 100%", while a home newly arrived at gives 74%. Without this we could not
   * tell which of two homes was which.
   */
  usualHistory: { country: string; from: Date }[];
  /**
   * The rung of the ladder this account has reached in each country it has travelled to,
   * worked out once and kept here rather than counted again for every post in every feed.
   *
   * Only the earned part lives here. What a home is worth is decided from `usual` and
   * `usualHistory` above, which cost nothing to read. This is refreshed whenever a day of
   * presence or a post from that country is added — the only two things that can move it.
   */
  earned: { country: string; percent: number }[];

  // Migration bookkeeping
  mysqlId?: number;

  createdAt: Date;
  updatedAt: Date;

  comparePassword(candidate: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    surname: { type: String, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['user', 'influencer', 'business', 'admin'], default: 'user', index: true },
    status: { type: String, enum: ['active', 'suspended', 'deleted'], default: 'active' },
    usernameUrl: { type: String, unique: true, sparse: true, trim: true },
    emailVerifiedAt: Date,
    acceptedTermsAndConditions: { type: Boolean, default: false },

    bio: { type: String, maxlength: 10000 },
    profilePicture: String,
    coverPicture: String,
    coverColor: { type: String, default: 'yellow' }, // Laravel default
    footerNameUsername: String,
    profilePictureBorderStatus: String,
    birth: String,
    country: String,
    gender: String,
    nationality: String,
    number: String,
    phone: String,
    categories: { type: [String], default: [] },
    /* INTERESTS — slugs, see the note on the interface above. */
    interests: { type: [String], default: [] },

    networks: { type: [String], default: [] },
    networkProfileLinks: { type: [String], default: [] },
    instagramLink: String,
    referredInfluencer: String,

    dni: String,
    companyName: String,
    companyId: String,
    address: String,

    priceOfSubscription: Number,
    bankAccount: String,
    paypalAccount: String,
    earnings: { type: Number, default: 0 },
    videoAdsEarnings: { type: Number, default: 0 },
    externalCustomerId: String,

    noOfFollowers: { type: Number, default: 0 },
    growthStatus: String,
    growthGearLevel: Number,
    growthStartTime: Date,
    followerGrowthTime: Date,
    vip: { type: Boolean, default: false },
    verified: { type: Boolean, default: false },
    pendingRedsysOrder: String,
    pendingRedsysPurpose: String,
    chatToggle: { type: Boolean, default: true },
    /* NOTIFICATIONS — when this reader last opened the panel. Everything newer than it is
       what the bell's unread count is counting. Absent on an account that has never opened
       it, which reads as "everything is unread". */
    notificationsSeenAt: { type: Date },
    /* SOUND EFFECTS — same default-on shape as chatToggle above. */
    soundEffects: { type: Boolean, default: true },
    /* ESTADO. Default `online` so an account that predates the field, or one that has
       never touched the switch, reads as online — which is also what login sets. */
    presence: {
      type: String,
      enum: ['online', 'away', 'disconnected'],
      default: 'online',
    },

    registeredIp: String,
    registeredCountry: String,
    visitedCountries: { type: [String], default: [] },
    usual: {
      type: {
        _id: false,
        country: { type: String, index: true },
        region: { type: String, default: null },
        since: { type: Date, default: null },
      },
      default: null,
    },
    current: {
      type: {
        _id: false,
        country: { type: String, index: true },
        region: { type: String, default: null },
        city: { type: String, default: null },
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
        seenAt: { type: Date },
      },
      default: null,
    },
    usualHistory: {
      type: [{ _id: false, country: String, from: Date }],
      default: [],
    },
    earned: {
      type: [{ _id: false, country: String, percent: Number }],
      default: [],
    },

    mysqlId: { type: Number, unique: true, sparse: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete (ret as Record<string, unknown>).password;
        return ret;
      },
    },
  },
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  // Already a bcrypt hash? (migration writes Laravel hashes directly)
  if (/^\$2[aby]\$/.test(this.password)) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function (candidate: string): Promise<boolean> {
  // Laravel emits $2y$ hashes; bcryptjs understands the $2a$/$2b$ flavor of the
  // same algorithm, so normalize the prefix before comparing.
  const hash = (this.password as string).replace(/^\$2y\$/, '$2b$');
  return bcrypt.compare(candidate, hash);
};

export const User: Model<IUser> = model<IUser>('User', userSchema);