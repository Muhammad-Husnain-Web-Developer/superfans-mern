/**
 * Fill the strip with test stories so the row, the arrows and the viewer can be exercised
 * with realistic data. Every document it writes carries `seeded: true`, which is the only
 * thing it will ever delete — real stories are never touched.
 *
 *   node scripts/seed-stories.mjs           # ~25 creators, 1-3 stories each
 *   node scripts/seed-stories.mjs 40        # that many creators
 *   node scripts/seed-stories.mjs --clear   # remove only what this script wrote
 *
 * The media is borrowed from posts that already exist on disk, so nothing is uploaded and
 * no file is left behind when the rows are cleared. Stories expire on their own after 24h
 * (the TTL index on expiresAt), so re-run this whenever the row has gone quiet again.
 */
import 'dotenv/config';
import mongoose from 'mongoose';

const URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/superfans';
const IMAGE = /\.(jpg|jpeg|png|gif|webp)$/i;
const LIFETIME_MS = 24 * 60 * 60 * 1000;

const args = process.argv.slice(2);
const clear = args.includes('--clear');
const wanted = Number(args.find((a) => /^\d+$/.test(a)) ?? 25);

await mongoose.connect(URI);
const db = mongoose.connection;
const stories = db.collection('stories');

if (clear) {
  const r = await stories.deleteMany({ seeded: true });
  console.log(`removed ${r.deletedCount} seeded stor${r.deletedCount === 1 ? 'y' : 'ies'}`);
  console.log(`real stories still in place: ${await stories.countDocuments({ seeded: { $ne: true } })}`);
  await mongoose.disconnect();
  process.exit(0);
}

/* one image per creator, taken from posts whose file is actually present */
const posts = await db
  .collection('posts')
  .find({ imageVideo: IMAGE, mediaMissing: { $ne: true }, visible: true }, { projection: { influencer: 1, imageVideo: 1 } })
  .limit(4000)
  .toArray();

const byCreator = new Map();
for (const p of posts) {
  const key = String(p.influencer);
  if (!byCreator.has(key)) byCreator.set(key, []);
  if (byCreator.get(key).length < 3) byCreator.get(key).push(p.imageVideo);
}

/* creators with the most material first, so the strip fills with real faces */
const creators = [...byCreator.entries()]
  .sort((a, b) => b[1].length - a[1].length)
  .slice(0, wanted);

if (creators.length === 0) {
  console.log('no usable post images found — nothing seeded');
  await mongoose.disconnect();
  process.exit(0);
}

const now = Date.now();
const docs = [];
for (const [uid, images] of creators) {
  /* staggered so the row is not in one block, and so "newest first" has something to sort */
  const ageMs = Math.floor(Math.random() * 18 * 60 * 60 * 1000);
  images.forEach((img, i) => {
    const created = new Date(now - ageMs + i * 60_000);
    docs.push({
      user: new mongoose.Types.ObjectId(uid),
      imageVideo: img,
      mediaType: 'image',
      elements: [],
      expiresAt: new Date(created.getTime() + LIFETIME_MS),
      noOfViews: Math.floor(Math.random() * 400),
      createdAt: created,
      updatedAt: created,
      seeded: true,
    });
  });
}

await stories.insertMany(docs);
console.log(`seeded ${docs.length} stories across ${creators.length} creators`);
const names = await db
  .collection('users')
  .find({ _id: { $in: creators.slice(0, 8).map(([id]) => new mongoose.Types.ObjectId(id)) } }, { projection: { name: 1 } })
  .toArray();
console.log('for example:', names.map((u) => u.name).filter(Boolean).join(', '));
console.log('clear them again with:  node scripts/seed-stories.mjs --clear');
await mongoose.disconnect();
