/**
 * Read-only: what the country rules know about one account.
 *
 *   node scripts/geo-status.mjs <username | email>
 *
 * Prints the usual and current country, every country the account has been seen in with the
 * days counted there, the reach earned, the place stamped on the latest posts, and any locks
 * that name the account. Nothing is written. Same connection default as the other scripts.
 */
import mongoose from 'mongoose';

const who = process.argv[2];
if (!who) {
  console.error('usage: node scripts/geo-status.mjs <username | email>');
  process.exit(1);
}
const MONGO = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/superfans';
await mongoose.connect(MONGO);
const db = mongoose.connection.db;

const user = await db.collection('users').findOne(
  { $or: [{ usernameUrl: who.replace(/^@/, '') }, { email: who.toLowerCase() }] },
  { projection: { usernameUrl: 1, email: 1, role: 1, usual: 1, current: 1, usualHistory: 1, earned: 1, visitedCountries: 1 } },
);
if (!user) {
  console.error(`no account "${who}"`);
  await mongoose.disconnect();
  process.exit(1);
}

const place = (p) => (p ? [p.country, p.region, p.city].filter(Boolean).join(' / ') : '—');
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '—');

console.log(`@${user.usernameUrl}  <${user.email}>  role=${user.role}`);
console.log(`  usual (home):   ${place(user.usual)}${user.usual?.since ? '  since ' + day(user.usual.since) : ''}`);
console.log(`  current:        ${place(user.current)}${user.current?.seenAt ? '  seen ' + new Date(user.current.seenAt).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : ''}`);
console.log(`  home history:   ${(user.usualHistory ?? []).map((h) => `${h.country} from ${day(h.from)}`).join(', ') || '—'}`);
console.log(`  visited:        ${(user.visitedCountries ?? []).join(', ') || '—'}`);

const days = await db
  .collection('presences')
  .aggregate([{ $match: { user: user._id } }, { $group: { _id: '$country', days: { $sum: 1 }, first: { $min: '$day' }, last: { $max: '$day' } } }, { $sort: { days: -1 } }])
  .toArray();
const posts = await db
  .collection('posts')
  .aggregate([{ $match: { influencer: user._id, 'place.country': { $exists: true, $ne: null } } }, { $group: { _id: '$place.country', posts: { $sum: 1 } } }])
  .toArray();
const postsIn = new Map(posts.map((p) => [p._id, p.posts]));
console.log('  presence days per country (what the ladder counts):');
if (days.length === 0) console.log('    none yet');
for (const d of days) {
  console.log(`    ${d._id}: ${d.days} day(s)  ${day(d.first)} → ${day(d.last)}   posts made there: ${postsIn.get(d._id) ?? 0}`);
}
console.log(`  reach earned:   ${(user.earned ?? []).map((e) => `${e.country} ${e.percent}%`).join(', ') || 'none yet (5 days + 15 posts is the first rung)'}`);

const latest = await db
  .collection('posts')
  .find({ influencer: user._id }, { projection: { place: 1, createdAt: 1, imageVideo: 1 }, sort: { createdAt: -1 }, limit: 5 })
  .toArray();
console.log('  latest posts and where they were made:');
for (const p of latest) console.log(`    ${day(p.createdAt)}  ${String(p.imageVideo ?? '').slice(0, 40).padEnd(40)}  ${p.place ? place(p.place) : '(no place — shown everywhere)'}`);

const locks = await db.collection('reachlocks').find({ kind: 'user', user: user._id }).toArray();
console.log(`  user locks:     ${locks.map((l) => `shown in ${place(l.to)} at ${l.percent}%`).join('; ') || 'none'}`);
const zones = await db.collection('reachlocks').find({ kind: 'zone' }).toArray();
console.log(`  zone locks (all): ${zones.map((l) => `${place(l.from)} → ${place(l.to)} at ${l.percent}%`).join('; ') || 'none'}`);

await mongoose.disconnect();
