/** MySQL → MongoDB migration for news (idempotent). Usage: npx tsx scripts/migrate-news.ts */
import 'dotenv/config';
import mysql from 'mysql2/promise';
import mongoose from 'mongoose';
import { News } from '../src/models/News.js';

const MYSQL_URI = process.env.MYSQL_URI ?? 'mysql://root@127.0.0.1:3306/superfanslaravel';
const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/superfans';

async function main() {
  const mysqlConn = await mysql.createConnection(MYSQL_URI);
  await mongoose.connect(MONGODB_URI);

  const [rows] = await mysqlConn.query<mysql.RowDataPacket[]>('SELECT * FROM news');
  let upserted = 0;
  for (const row of rows) {
    await News.updateOne(
      { mysqlId: row.id },
      {
        $set: {
          title: row.title,
          content: row.content,
          image: row.image ?? undefined,
          status: row.status === 'paused' ? 'paused' : 'active',
          buttonText: row.button_text ?? undefined,
          buttonLink: row.button_link ?? undefined,
          createdAt: row.created_at ? new Date(row.created_at) : new Date(),
        },
      },
      { upsert: true },
    );
    upserted++;
  }

  console.log(`news migrated: ${upserted}`);
  await mysqlConn.end();
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
