import { Schema, model, type Types } from 'mongoose';

export interface IPost {
  influencer: Types.ObjectId;
  /** media filename (image or video) in /assets/images, as in Laravel */
  imageVideo?: string;
  thumbnail?: string;
  noOfLikes: number;
  noOfViews: number;
  /** admin-typed ❤️/💩 percentage seed (0-100); null = derive from the real rows alone */
  likePercent?: number | null;
  /** true when that percentage was typed on this post on its own. The client's rule: a
   *  figure set post by post is the admin's judgement and the bulk "apply to all" must
   *  leave it exactly as it is. */
  likePercentManual?: boolean;
  visible: boolean;
  tags: string[];
  taggedProfilePictures: string[];
  growthStartTime?: Date;
  mysqlId?: number;
  /** true when the media file is absent on disk — such posts are hidden from all listings
   *  (recomputed by scripts/flag-missing-media). */
  mediaMissing?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const postSchema = new Schema<IPost>(
  {
    influencer: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    imageVideo: String,
    thumbnail: String,
    noOfLikes: { type: Number, default: 0 },
    noOfViews: { type: Number, default: 0 },
    likePercent: { type: Number, default: null },
    likePercentManual: { type: Boolean, default: false },
    visible: { type: Boolean, default: false }, // Laravel default 0
    tags: { type: [String], default: [] },
    taggedProfilePictures: { type: [String], default: [] },
    growthStartTime: Date,
    mysqlId: { type: Number, unique: true, sparse: true },
    mediaMissing: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

postSchema.index({ influencer: 1, createdAt: -1 });

/**
 * Hide posts whose media file is missing from every listing/detail query by default, so a
 * broken image never reaches the frontend. Pass `.setOptions({ withMissing: true })` (or query
 * mediaMissing explicitly) to include them — used by admin tools and the flagging script.
 */
postSchema.pre(/^find/, function (this: { getOptions: () => Record<string, unknown>; getQuery: () => Record<string, unknown>; where: (c: Record<string, unknown>) => unknown }) {
  if (this.getOptions().withMissing) return;
  if (this.getQuery().mediaMissing === undefined) {
    this.where({ mediaMissing: { $ne: true } });
  }
});

/** Same hiding for aggregation pipelines (the world feed uses Post.aggregate). Prepend a
 *  $match so broken-media posts drop out; bypass with Post.aggregate(p, { withMissing: true }). */
postSchema.pre('aggregate', function () {
  const agg = this as unknown as { options?: { withMissing?: boolean }; pipeline: () => Record<string, unknown>[] };
  if (agg.options?.withMissing) return;
  agg.pipeline().unshift({ $match: { mediaMissing: { $ne: true } } });
});

export const Post = model<IPost>('Post', postSchema);
