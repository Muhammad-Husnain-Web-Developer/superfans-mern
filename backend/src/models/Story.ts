import { Schema, model, type Types } from 'mongoose';

/** How long a story stays up. The client asked for Instagram's 24 hours. */
export const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;
/** The client's cap on story video. Enforced in the browser and again on upload. */
export const STORY_MAX_VIDEO_SECONDS = 60;

/**
 * One overlay dropped on the canvas in the editor (mockups Pas 3 + Pas 4). Position is
 * stored as a fraction of the canvas (0..1) so a story composed on a phone lands in the
 * same place on a desktop viewer; rotation is degrees.
 *
 * Phase 1 never writes these — the editor arrives in phase 2 — but the shape is settled
 * now so adding it later is not a schema change.
 */
export interface IStoryElement {
  kind: 'tag' | 'link' | 'text';
  x: number;
  y: number;
  rotation: number;
  scale: number;
  /** kind 'tag': the tagged user's handle */
  username?: string;
  /** kind 'link': the destination and the caption shown on the chip */
  url?: string;
  title?: string;
  /** kind 'text': the words, one of the four named fonts, and the chosen colour */
  text?: string;
  font?: 'gamer' | 'spacial' | 'classic' | 'base';
  color?: string;
}

export interface IStory {
  user: Types.ObjectId;
  imageVideo: string;
  thumbnail?: string;
  mediaType: 'image' | 'video';
  /** video length in seconds, as measured on upload; absent for images */
  durationSeconds?: number;
  elements: IStoryElement[];
  expiresAt: Date;
  noOfViews: number;
  createdAt: Date;
  updatedAt: Date;
}

const storyElementSchema = new Schema<IStoryElement>(
  {
    kind: { type: String, enum: ['tag', 'link', 'text'], required: true },
    x: { type: Number, default: 0.5 },
    y: { type: Number, default: 0.5 },
    rotation: { type: Number, default: 0 },
    scale: { type: Number, default: 1 },
    username: String,
    url: String,
    title: String,
    text: String,
    font: { type: String, enum: ['gamer', 'spacial', 'classic', 'base'] },
    color: String,
  },
  { _id: false },
);

const storySchema = new Schema<IStory>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    imageVideo: { type: String, required: true },
    thumbnail: String,
    mediaType: { type: String, enum: ['image', 'video'], required: true },
    durationSeconds: Number,
    elements: { type: [storyElementSchema], default: [] },
    expiresAt: { type: Date, required: true },
    noOfViews: { type: Number, default: 0 },
  },
  { timestamps: true },
);

/* Mongo drops the document itself once expiresAt passes, so nothing has to sweep the
   collection. The media file it points at is a separate matter — scripts/prune-stories.mjs
   deletes the orphans, since Mongo's TTL monitor cannot reach the disk. */
storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
/* the two reads this feature makes: one user's live stories, and the whole live strip */
storySchema.index({ user: 1, createdAt: 1 });

export const Story = model<IStory>('Story', storySchema);
