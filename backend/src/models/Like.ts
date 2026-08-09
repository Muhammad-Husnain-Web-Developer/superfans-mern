import { Schema, model, type Types } from 'mongoose';

export interface ILike {
  post: Types.ObjectId;
  user: Types.ObjectId;
  mysqlId?: number;
  createdAt: Date;
  updatedAt: Date;
}

const likeSchema = new Schema<ILike>(
  {
    post: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    mysqlId: { type: Number, unique: true, sparse: true },
  },
  { timestamps: true },
);

likeSchema.index({ post: 1, user: 1 }, { unique: true });

export const Like = model<ILike>('Like', likeSchema);
