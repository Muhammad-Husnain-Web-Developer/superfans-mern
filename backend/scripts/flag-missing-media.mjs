/**
 * Recompute Post.mediaMissing from disk. Run after moving/adding assets:
 *   node scripts/flag-missing-media.mjs
 * Posts whose imageVideo file is absent (or 0-byte) are flagged mediaMissing:true so the
 * app's global pre-find hook hides them everywhere; recovered files un-flag on the next run.
 */
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

const MONGO = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/superfans';
const dirs = [path.resolve('uploads'), path.resolve('legacy-assets/images')];

const exists = (name) => {
  if (!name) return false;
  for (const base of dirs) {
    try { if (fs.statSync(path.join(base, name)).size > 0) return true; } catch { /* next */ }
  }
  return false;
};

await mongoose.connect(MONGO);
const col = mongoose.connection.db.collection('posts');
const posts = await col.find({}, { projection: { imageVideo: 1 } }).toArray();

const ops = [];
let missing = 0;
for (const p of posts) {
  const bad = !exists(p.imageVideo);
  if (bad) missing++;
  ops.push({ updateOne: { filter: { _id: p._id }, update: { $set: { mediaMissing: bad } } } });
}
if (ops.length) await col.bulkWrite(ops, { ordered: false });

console.log(`Scanned ${posts.length} posts → ${missing} flagged mediaMissing, ${posts.length - missing} visible.`);
await mongoose.disconnect();
