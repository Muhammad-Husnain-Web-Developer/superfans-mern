/**
 * MySQL → MongoDB migration for followerships and subscriptions (idempotent).
 * Usage: npx tsx scripts/migrate-follows.ts
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';
import mongoose, { type Types } from 'mongoose';
import { User } from '../src/models/User.js';
import { Followership } from '../src/models/Followership.js';
import { Subscription } from '../src/models/Subscription.js';

const MYSQL_URI = process.env.MYSQL_URI ?? 'mysql://root@127.0.0.1:3306/superfanslaravel';
const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/superfans';

async function main() {
  const mysqlConn = await mysql.createConnection(MYSQL_URI);
  await mongoose.connect(MONGODB_URI);

  const users = await User.find({ mysqlId: { $ne: null } }, { mysqlId: 1 }).lean();
  const byId = new Map<number, Types.ObjectId>(users.map((u) => [u.mysqlId!, u._id]));

  const [follows] = await mysqlConn.query<mysql.RowDataPacket[]>('SELECT * FROM followerships');
  let f = 0;
  let fSkip = 0;
  for (const row of follows) {
    const followed = byId.get(Number(row.followed_user_id));
    const follower = byId.get(Number(row.follower_user_id));
    if (!followed || !follower) {
      fSkip++;
      continue;
    }
    await Followership.updateOne(
      { mysqlId: row.id },
      {
        $set: {
          followedUser: followed,
          followerUser: follower,
          createdAt: row.created_at ?? new Date(),
          updatedAt: row.updated_at ?? new Date(),
        },
      },
      { upsert: true, timestamps: false },
    );
    f++;
  }
  console.log(`Followerships: ${f} migrated, ${fSkip} skipped`);

  const [subs] = await mysqlConn.query<mysql.RowDataPacket[]>('SELECT * FROM subscriptions');
  let s = 0;
  let sSkip = 0;
  for (const row of subs) {
    const user = byId.get(Number(row.user_id));
    const influencer = byId.get(Number(row.influencer_id));
    if (!user) {
      sSkip++;
      continue;
    }
    await Subscription.updateOne(
      { mysqlId: row.id },
      {
        $set: {
          user,
          influencer: influencer ?? undefined,
          amount: Number(row.amount) || 0,
          plan: row.plan === 'quinzenal' ? 'quinzenal' : 'monthly',
          nextPaymentAt: row.next_payment_at ?? undefined,
          createdAt: row.created_at ?? new Date(),
          updatedAt: row.updated_at ?? new Date(),
        },
      },
      { upsert: true, timestamps: false },
    );
    s++;
  }
  console.log(`Subscriptions: ${s} migrated, ${sSkip} skipped`);

  await mysqlConn.end();
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
