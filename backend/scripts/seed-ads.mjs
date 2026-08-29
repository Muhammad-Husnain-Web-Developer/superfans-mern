/**
 * One ad of every type the Ads Center sells, so the preview wall can be looked at — and
 * screenshotted for the client — with a real ad behind every call-to-action button.
 *
 *   node scripts/seed-ads.mjs           # create the thirteen
 *   node scripts/seed-ads.mjs --clear   # remove only what this script wrote
 *
 * Everything it writes carries `seeded: true`; that is the only thing --clear ever deletes,
 * so the real ads are never touched. Artwork is borrowed from ads that already have their
 * file on disk, so nothing is uploaded and no file is left behind when the rows are cleared.
 *
 * The links are the same shape the Ads Center itself writes (ads.routes buildAd): a `tel:`
 * address for a calls ad, a wa.me address for WhatsApp, the advertiser's own URL otherwise.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';

const URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/superfans';
const UPLOADS = path.resolve(process.env.UPLOADS_DIR ?? 'uploads');
const LEGACY = process.env.LEGACY_ASSETS_DIR
  ? path.resolve(process.env.LEGACY_ASSETS_DIR, 'images')
  : null;

/* type → the link the Ads Center would have written for it */
const TYPES = [
  ['promote-post', 'https://app.superfans.world/world'],
  ['profile-followers', 'https://app.superfans.world/martinherrada'],
  ['messages', 'https://app.superfans.world/user/messages'],
  ['instagram', 'https://instagram.com/superfans.world'],
  ['tiktok', 'https://tiktok.com/@superfans.world'],
  ['twitch', 'https://twitch.tv/superfansworld'],
  ['youtube', 'https://youtube.com/@superfansworld'],
  ['amazon', 'https://amazon.es/shop/superfans'],
  ['spotify', 'https://open.spotify.com/artist/superfans'],
  ['website-visits', 'https://superfans.world'],
  ['calls', 'tel:+34600123456'],
  ['whatsapp', 'https://wa.me/34600123456'],
  ['clients-form', 'https://superfans.world'],
];

const onDisk = (file) =>
  !!file &&
  file.indexOf('/') === -1 &&
  file.indexOf('\\') === -1 &&
  [UPLOADS, LEGACY].filter(Boolean).some((d) => fs.existsSync(path.join(d, file)));

await mongoose.connect(URI);
const db = mongoose.connection;
const ads = db.collection('ads');
const forms = db.collection('adformularyforms');

if (process.argv.includes('--clear')) {
  const seeded = await ads.find({ seeded: true }, { projection: { _id: 1 } }).toArray();
  await forms.deleteMany({ ad: { $in: seeded.map((a) => a._id) } });
  const r = await ads.deleteMany({ seeded: true });
  console.log(`removed ${r.deletedCount} seeded ad(s)`);
  console.log(`real ads still in place: ${await ads.countDocuments({ seeded: { $ne: true } })}`);
  await mongoose.disconnect();
  process.exit(0);
}

/* artwork that is actually present, so no tile comes out empty */
const art = (
  await ads.find({ media: { $ne: null }, seeded: { $ne: true } }, { projection: { media: 1 } }).toArray()
)
  .map((a) => a.media)
  .filter(onDisk);

if (art.length === 0) {
  console.log('no ad artwork found on disk — nothing seeded');
  await mongoose.disconnect();
  process.exit(0);
}

/* an advertiser the Follow/Subscribe buttons can lead back to */
const owner =
  (await db.collection('users').findOne({ usernameUrl: 'martinherrada' }, { projection: { _id: 1, usernameUrl: 1 } })) ??
  (await db.collection('users').findOne({ usernameUrl: { $ne: null } }, { projection: { _id: 1, usernameUrl: 1 } }));

const top = await ads.find({}, { projection: { mysqlId: 1 } }).sort({ mysqlId: -1 }).limit(1).toArray();
let nextId = (top[0]?.mysqlId ?? 0) + 1;

const now = Date.now();
const docs = TYPES.map(([adType, link], i) => ({
  mysqlId: nextId++,
  user: owner._id,
  adType,
  /* spread across whatever artwork exists, so the row is not thirteen of one picture */
  media: art[i % art.length],
  link,
  status: true,
  approved: true,
  amount: 15,
  impressions: 0,
  clicks: 0,
  country: 'Spain',
  city: 'Madrid',
  createdAt: new Date(now - i * 1000),
  updatedAt: new Date(now - i * 1000),
  seeded: true,
}));

const { insertedIds } = await ads.insertMany(docs);

/* the clients-form tile needs its questionnaire behind it or it draws nothing */
const formIndex = TYPES.findIndex(([t]) => t === 'clients-form');
await forms.insertOne({
  ad: insertedIds[formIndex],
  title: 'Tell us about your project',
  question1: 'What are you interested in?',
  question2: 'What is your budget?',
  askName: 1,
  askEmail: 1,
  askPhone: 1,
  askCompany: 0,
  buttonAction: 'More Info',
  country: 'Spain',
  city: 'Madrid',
  createdAt: new Date(),
  updatedAt: new Date(),
});

console.log(`seeded ${docs.length} ads, one of every type, as @${owner.usernameUrl}`);
for (const [t] of TYPES) console.log('   -', t);
console.log('\nclear them again with:  node scripts/seed-ads.mjs --clear');
await mongoose.disconnect();
