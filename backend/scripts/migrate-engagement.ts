/** MySQL → MongoDB migration for hates + post_visits (idempotent). */
import 'dotenv/config';
import mysql from 'mysql2/promise';
import mongoose, { type Types } from 'mongoose';
import { User } from '../src/models/User.js';
import { Post } from '../src/models/Post.js';
import { Hate } from '../src/models/Hate.js';
import { PostVisit } from '../src/models/PostVisit.js';

const MYSQL_URI = process.env.MYSQL_URI ?? 'mysql://root@127.0.0.1:3306/superfanslaravel';
const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/superfans';

async function main() {
  const mysqlConn = await mysql.createConnection(MYSQL_URI);
  await mongoose.connect(MONGODB_URI);

  const users = await User.find({ mysqlId: { $ne: null } }, { mysqlId: 1 }).lean();
  const userById = new Map<number, Types.ObjectId>(users.map((u) => [u.mysqlId!, u._id]));
  const posts = await Post.find({ mysqlId: { $ne: null } }, { mysqlId: 1 }).lean();
  const postById = new Map<number, Types.ObjectId>(posts.map((p) => [p.mysqlId!, p._id]));

  const [hates] = await mysqlConn.query<mysql.RowDataPacket[]>('SELECT * FROM hates');
  let h = 0;
  for (const row of hates) {
    const post = postById.get(Number(row.post_id));
    const user = userById.get(Number(row.user_id));
    if (!post || !user) continue;
    await Hate.updateOne(
      { mysqlId: row.id },
      {
        $set: {
          post,
          user,
          influencer: row.influencer_id ? userById.get(Number(row.influencer_id)) : undefined,
          createdAt: row.created_at ?? new Date(),
          updatedAt: row.updated_at ?? new Date(),
        },
      },
      { upsert: true, timestamps: false },
    );
    h++;
  }
  console.log(`Hates: ${h} migrated`);

  const [visits] = await mysqlConn.query<mysql.RowDataPacket[]>('SELECT * FROM post_visits');
  let v = 0;
  for (const row of visits) {
    const post = postById.get(Number(row.post_id));
    if (!post) continue;
    await PostVisit.updateOne(
      { mysqlId: row.id },
      {
        $set: {
          post,
          user: row.user_id ? userById.get(Number(row.user_id)) : undefined,
          ipAddress: row.ip_address ?? undefined,
          createdAt: row.created_at ?? new Date(),
          updatedAt: row.updated_at ?? new Date(),
        },
      },
      { upsert: true, timestamps: false },
    );
    v++;
  }
  console.log(`Post visits: ${v} migrated`);

  await mysqlConn.end();
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
