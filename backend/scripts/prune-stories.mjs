/**
 * Delete story media whose story has expired:
 *   node scripts/prune-stories.mjs            # report only
 *   node scripts/prune-stories.mjs --delete   # actually remove the files
 *
 * A story document removes itself 24 hours after it is posted — Mongo's TTL monitor does
 * that from the expiresAt index. The monitor cannot reach the disk, though, so the picture
 * or clip it pointed at stays in uploads/ forever. This sweeps those orphans up.
 *
 * Only files named the way the story route names them (story<timestamp>_...) are ever
 * considered, so nothing belonging to a post can be caught by mistake.
 */
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

const MONGO = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/superfans';
const uploads = path.resolve('uploads');
const thumbs = path.join(uploads, 'thumbnails');
const doDelete = process.argv.includes('--delete');

await mongoose.connect(MONGO);
const live = await mongoose.connection
  .collection('stories')
  .find({}, { projection: { imageVideo: 1, thumbnail: 1 } })
  .toArray();
await mongoose.disconnect();

const keep = new Set();
for (const s of live) {
  if (s.imageVideo) keep.add(s.imageVideo);
  if (s.thumbnail) keep.add(s.thumbnail);
}

let files = [];
try {
  files = fs.readdirSync(uploads);
} catch {
  console.error(`No uploads directory at ${uploads}`);
  process.exit(1);
}

const orphans = files.filter((f) => /^story\d+_/.test(f) && !keep.has(f));
let bytes = 0;
for (const f of orphans) {
  const full = path.join(uploads, f);
  try {
    bytes += fs.statSync(full).size;
  } catch {
    /* vanished between the listing and now */
  }
  if (doDelete) {
    fs.rmSync(full, { force: true });
    /* the thumbnail a video story generated carries the same stem */
    fs.rmSync(path.join(thumbs, `${path.parse(f).name}.jpg`), { force: true });
  }
}

const mb = (bytes / 1048576).toFixed(1);
console.log(`${live.length} live stories · ${orphans.length} orphaned files (${mb} MB)`);
console.log(doDelete ? 'deleted.' : 'nothing deleted — pass --delete to remove them.');
