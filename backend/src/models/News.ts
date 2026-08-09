import { Schema, model } from 'mongoose';

/** Site news item (mirrors MySQL `news`): a title/content card with an optional
 *  image and an optional call-to-action button. */
export interface INews {
  title: string;
  content: string;
  image?: string;
  status: 'active' | 'paused';
  buttonText?: string;
  buttonLink?: string;
  mysqlId?: number;
  createdAt: Date;
  updatedAt: Date;
}

const newsSchema = new Schema<INews>(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
    image: String,
    status: { type: String, enum: ['active', 'paused'], default: 'active' },
    buttonText: String,
    buttonLink: String,
    mysqlId: { type: Number, unique: true, sparse: true },
  },
  { timestamps: true },
);

export const News = model<INews>('News', newsSchema);
