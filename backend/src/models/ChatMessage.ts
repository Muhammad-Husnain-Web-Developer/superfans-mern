import { Schema, model, type Types } from 'mongoose';

/** A one-to-one chat message (mirrors MySQL `chatbox`: sender → receiver + text). */
export interface IChatMessage {
  sender: Types.ObjectId;
  receiver: Types.ObjectId;
  message: string;
  mysqlId?: number;
  createdAt: Date;
  updatedAt: Date;
}

const chatMessageSchema = new Schema<IChatMessage>(
  {
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    receiver: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    message: { type: String, required: true },
    mysqlId: { type: Number, unique: true, sparse: true },
  },
  { timestamps: true },
);

/** Fetching a conversation queries both directions between a pair, ordered by time. */
chatMessageSchema.index({ sender: 1, receiver: 1, createdAt: 1 });

export const ChatMessage = model<IChatMessage>('ChatMessage', chatMessageSchema);
