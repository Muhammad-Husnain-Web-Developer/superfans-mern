import { Schema, model } from 'mongoose';

export interface ISocialNetwork {
  mysqlId: number;
  name: string;
  defaultAddress: string;
  /** sidebar/inline icon filename in /assets/images */
  image: string;
  /** locked-style tile shown in the profile grid */
  feedImage: string;
}

const socialNetworkSchema = new Schema<ISocialNetwork>(
  {
    mysqlId: { type: Number, unique: true },
    name: { type: String, required: true },
    defaultAddress: { type: String, default: '' },
    image: { type: String, default: '' },
    feedImage: { type: String, default: '' },
  },
  { timestamps: true },
);

export const SocialNetwork = model<ISocialNetwork>('SocialNetwork', socialNetworkSchema);
