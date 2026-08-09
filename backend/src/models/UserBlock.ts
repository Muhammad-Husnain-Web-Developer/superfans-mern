import { Schema, model, type Types } from 'mongoose';

/** Block relationship (mirrors MySQL `user_blocks` pivot). */
export interface IUserBlock {
  blocker: Types.ObjectId;
  blocked: Types.ObjectId;
  mysqlId?: number;
  createdAt: Date;
  updatedAt: Date;
}

const userBlockSchema = new Schema<IUserBlock>(
  {
    blocker: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    blocked: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    mysqlId: { type: Number, unique: true, sparse: true },
  },
  { timestamps: true },
);

userBlockSchema.index({ blocker: 1, blocked: 1 }, { unique: true });

export const UserBlock = model<IUserBlock>('UserBlock', userBlockSchema);
