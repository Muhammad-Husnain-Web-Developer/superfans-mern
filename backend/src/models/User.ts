import { Schema, model, type Document, type Model } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole = 'user' | 'influencer' | 'business' | 'admin';
export type UserStatus = 'active' | 'suspended';

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

  // Geo tracking
  registeredIp?: string;
  registeredCountry?: string;
  visitedCountries: string[];

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
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
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

    registeredIp: String,
    registeredCountry: String,
    visitedCountries: { type: [String], default: [] },

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
