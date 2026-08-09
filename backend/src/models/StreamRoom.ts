import { Schema, model, Types } from 'mongoose';

/** A live-stream room (mirrors MySQL `stream_rooms`): the creator opens one with a
 *  bio + tags before going live, and the broadcaster page is keyed by `roomName`. */
export interface IStreamRoom {
  roomName: string;
  bio: string;
  tags: string;
  user: Types.ObjectId;
  mysqlId?: number;
  createdAt: Date;
  updatedAt: Date;
}

const streamRoomSchema = new Schema<IStreamRoom>(
  {
    roomName: { type: String, required: true, unique: true, index: true },
    bio: { type: String, required: true },
    tags: { type: String, required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    mysqlId: { type: Number, unique: true, sparse: true },
  },
  { timestamps: true },
);

export const StreamRoom = model<IStreamRoom>('StreamRoom', streamRoomSchema);
