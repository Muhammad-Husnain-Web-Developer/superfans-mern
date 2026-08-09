/**
 * MySQL → MongoDB migration for posts and likes (idempotent, keyed by mysqlId).
 * Requires migrate-users.ts to have run first (posts reference users by mysqlId).
 *
 * Usage: npx tsx scripts/migrate-posts.ts
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';
import mongoose, { type Types } from 'mongoose';
import { User } from '../src/models/User.js';
import { Post } from '../src/models/Post.js';
import { Like } from '../src/models/Like.js';

const MYSQL_URI = process.env.MYSQL_URI ?? 'mysql://root@127.0.0.1:3306/superfanslaravel';
const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/superfans';

function csv(value: string | null): string[] {
  return value
    ? value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
}

async function main() {
  const mysqlConn = await mysql.createConnection(MYSQL_URI);
  await mongoose.connect(MONGODB_URI);

  // mysql user id → mongo _id
  const users = await User.find({ mysqlId: { $ne: null } }, { mysqlId: 1 }).lean();
  const userByMysqlId = new Map<number, Types.ObjectId>(users.map((u) => [u.mysqlId!, u._id]));
  console.log(`User map: ${userByMysqlId.size} users`);

  /* ---- posts ---- */
  const [postRows] = await mysqlConn.query<mysql.RowDataPacket[]>('SELECT * FROM posts');
  let posts = 0;
  let postsSkipped = 0;
  for (const p of postRows) {
    const influencerId = userByMysqlId.get(Number(p.influencer_id));
    if (!influencerId) {
      postsSkipped++;
      continue; // orphan post (user deleted)
    }
    await Post.updateOne(
      { mysqlId: p.id },
      {
        $set: {
          influencer: influencerId,
          imageVideo: p.image_video ?? undefined,
          thumbnail: p.thumbnail ?? undefined,
          noOfLikes: p.no_of_likes ?? 0,
          visible: !!p.visible,
          tags: csv(p.tags),
          taggedProfilePictures: csv(p.tagged_profile_pictures),
          growthStartTime: p.growth_start_time ?? undefined,
          createdAt: p.created_at ?? new Date(),
          updatedAt: p.updated_at ?? new Date(),
        },
      },
      { upsert: true, timestamps: false },
    );
    posts++;
  }
  console.log(`Posts: migrated ${posts}, skipped (orphans) ${postsSkipped}`);

  /* ---- likes ---- */
  const postDocs = await Post.find({ mysqlId: { $ne: null } }, { mysqlId: 1 }).lean();
  const postByMysqlId = new Map<number, Types.ObjectId>(postDocs.map((p) => [p.mysqlId!, p._id]));

  const [likeRows] = await mysqlConn.query<mysql.RowDataPacket[]>('SELECT * FROM likes');
  let likes = 0;
  let likesSkipped = 0;
  for (const l of likeRows) {
    const postId = postByMysqlId.get(Number(l.post_id));
    const userId = userByMysqlId.get(Number(l.user_id));
    if (!postId || !userId) {
      likesSkipped++;
      continue;
    }
    try {
      await Like.updateOne(
        { mysqlId: l.id },
        {
          $set: {
            post: postId,
            user: userId,
            createdAt: l.created_at ?? new Date(),
            updatedAt: l.updated_at ?? new Date(),
          },
        },
        { upsert: true, timestamps: false },
      );
      likes++;
    } catch {
      likesSkipped++; // duplicate (same user liked twice in MySQL)
    }
  }
  console.log(`Likes: migrated ${likes}, skipped ${likesSkipped}`);

  await mysqlConn.end();
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
