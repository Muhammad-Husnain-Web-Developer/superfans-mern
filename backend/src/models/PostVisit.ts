import { Schema, model, type Types } from 'mongoose';

/** Post view tracking (mirrors MySQL `post_visits`). */
export interface IPostVisit {
  post: Types.ObjectId;
  user?: Types.ObjectId;
  ipAddress?: string;
  mysqlId?: number;
  createdAt: Date;
  updatedAt: Date;
}

const postVisitSchema = new Schema<IPostVisit>(
  {
    post: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    ipAddress: String,
    mysqlId: { type: Number, unique: true, sparse: true },
  },
  { timestamps: true },
);

export const PostVisit = model<IPostVisit>('PostVisit', postVisitSchema);
