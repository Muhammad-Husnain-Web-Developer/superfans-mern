import { Schema, model, type Types } from 'mongoose';

/** Free follow (mirrors MySQL `followerships`). */
export interface IFollowership {
  followedUser: Types.ObjectId;
  followerUser: Types.ObjectId;
  mysqlId?: number;
  createdAt: Date;
  updatedAt: Date;
}

const followershipSchema = new Schema<IFollowership>(
  {
    followedUser: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    followerUser: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    mysqlId: { type: Number, unique: true, sparse: true },
  },
  { timestamps: true },
);

export const Followership = model<IFollowership>('Followership', followershipSchema);
