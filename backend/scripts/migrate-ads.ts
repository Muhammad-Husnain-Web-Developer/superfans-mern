/** MySQL → MongoDB migration for ads (idempotent). Usage: npx tsx scripts/migrate-ads.ts */
import 'dotenv/config';
import mysql from 'mysql2/promise';
import mongoose, { type Types } from 'mongoose';
import { User } from '../src/models/User.js';
import { Ad } from '../src/models/Ad.js';

const MYSQL_URI = process.env.MYSQL_URI ?? 'mysql://root@127.0.0.1:3306/superfanslaravel';
const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/superfans';

async function main() {
  const mysqlConn = await mysql.createConnection(MYSQL_URI);
  await mongoose.connect(MONGODB_URI);

  const users = await User.find({ mysqlId: { $ne: null } }, { mysqlId: 1 }).lean();
  const byId = new Map<number, Types.ObjectId>(users.map((u) => [u.mysqlId!, u._id]));

  const [rows] = await mysqlConn.query<mysql.RowDataPacket[]>('SELECT * FROM ads');
  let n = 0;
  for (const row of rows) {
    if (!row.media) continue;
    await Ad.updateOne(
      { mysqlId: row.id },
      {
        $set: {
          user: row.user_id ? byId.get(Number(row.user_id)) : undefined,
          adType: row.ad_type ?? undefined,
          media: row.media,
          link: row.link ?? undefined,
          status: !!row.status,
          approved: !!row.approved,
          amount: row.amount !== null ? Number(row.amount) : undefined,
          impressions: Number(row.impressions) || 0,
          clicks: Number(row.clicks) || 0,
          country: row.country ?? undefined,
          city: row.city ?? undefined,
          createdAt: row.created_at ?? new Date(),
          updatedAt: row.updated_at ?? new Date(),
        },
      },
      { upsert: true, timestamps: false },
    );
    n++;
  }
  console.log(`Ads: ${n} migrated`);
  await mysqlConn.end();
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
