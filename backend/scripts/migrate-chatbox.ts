/** MySQL → MongoDB migration for chatbox messages (idempotent). Usage: npx tsx scripts/migrate-chatbox.ts */
import 'dotenv/config';
import mysql from 'mysql2/promise';
import mongoose, { type Types } from 'mongoose';
import { User } from '../src/models/User.js';
import { ChatMessage } from '../src/models/ChatMessage.js';

const MYSQL_URI = process.env.MYSQL_URI ?? 'mysql://root@127.0.0.1:3306/superfanslaravel';
const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/superfans';

async function main() {
  const mysqlConn = await mysql.createConnection(MYSQL_URI);
  await mongoose.connect(MONGODB_URI);

  const users = await User.find({ mysqlId: { $ne: null } }, { mysqlId: 1 }).lean();
  const byId = new Map<number, Types.ObjectId>(users.map((u) => [u.mysqlId!, u._id]));

  const [rows] = await mysqlConn.query<mysql.RowDataPacket[]>('SELECT * FROM chatbox');
  let upserted = 0;
  let skipped = 0;
  for (const row of rows) {
    const sender = byId.get(Number(row.sender_id));
    const receiver = byId.get(Number(row.receiver_id));
    if (!sender || !receiver) {
      skipped++;
      continue; // a party no longer exists in the migrated user set
    }
    await ChatMessage.updateOne(
      { mysqlId: row.id },
      {
        $set: {
          sender,
          receiver,
          message: row.message,
          createdAt: row.created_at ? new Date(row.created_at) : new Date(),
        },
      },
      { upsert: true },
    );
    upserted++;
  }

  console.log(`chatbox migrated: ${upserted}, skipped (missing user): ${skipped}`);
  await mysqlConn.end();
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
