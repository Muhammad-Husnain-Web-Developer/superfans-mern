/** MySQL → MongoDB migration for user_blocks (idempotent). */
import 'dotenv/config';
import mysql from 'mysql2/promise';
import mongoose, { type Types } from 'mongoose';
import { User } from '../src/models/User.js';
import { UserBlock } from '../src/models/UserBlock.js';

const MYSQL_URI = process.env.MYSQL_URI ?? 'mysql://root@127.0.0.1:3306/superfanslaravel';
const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/superfans';

async function main() {
  const mysqlConn = await mysql.createConnection(MYSQL_URI);
  await mongoose.connect(MONGODB_URI);

  const users = await User.find({ mysqlId: { $ne: null } }, { mysqlId: 1 }).lean();
  const byId = new Map<number, Types.ObjectId>(users.map((u) => [u.mysqlId!, u._id]));

  const [rows] = await mysqlConn.query<mysql.RowDataPacket[]>('SELECT * FROM user_blocks');
  let n = 0;
  for (const row of rows) {
    const blocker = byId.get(Number(row.blocker_id));
    const blocked = byId.get(Number(row.blocked_id));
    if (!blocker || !blocked) continue;
    await UserBlock.updateOne(
      { mysqlId: row.id },
      { $set: { blocker, blocked, createdAt: row.created_at ?? new Date(), updatedAt: row.updated_at ?? new Date() } },
      { upsert: true, timestamps: false },
    );
    n++;
  }
  console.log(`User blocks: ${n} migrated`);
  await mysqlConn.end();
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
