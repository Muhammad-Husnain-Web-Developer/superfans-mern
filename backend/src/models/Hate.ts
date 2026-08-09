import { Schema, model, type Types } from 'mongoose';

/** "Hate" (dislike) on a post (mirrors MySQL `hates`). */
export interface IHate {
  post: Types.ObjectId;
  user: Types.ObjectId;
  influencer?: Types.ObjectId;
  mysqlId?: number;
  createdAt: Date;
  updatedAt: Date;
}

const hateSchema = new Schema<IHate>(
  {
    post: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    influencer: { type: Schema.Types.ObjectId, ref: 'User' },
    mysqlId: { type: Number, unique: true, sparse: true },
  },
  { timestamps: true },
);

hateSchema.index({ post: 1, user: 1 }, { unique: true });

export const Hate = model<IHate>('Hate', hateSchema);
