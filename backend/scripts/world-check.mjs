/**
 * Read-only: is an account's work in the WORLD feed, as seen from a given country?
 *
 *   node scripts/world-check.mjs <username> [ES|PK|US|... or an IP] [loads]
 *
 * Fetches every page of /api/world as a signed-out reader from that country and reports how
 * many posts by the account came back, over several loads (the feed is sampled afresh each
 * time). No account is signed in, so nothing is recorded anywhere.
 *
 * The country is carried in X-Forwarded-For, which the API only believes from this machine
 * (`trust proxy` is loopback) — so this runs on the server itself, or against a local dev API.
 * Set API=http://127.0.0.1:5000 to point it elsewhere.
 */
const [, , who, where = 'ES', loadsArg = '3'] = process.argv;
if (!who) {
  console.error('usage: node scripts/world-check.mjs <username> [country|ip] [loads]');
  process.exit(1);
}
const API = (process.env.API || 'http://127.0.0.1:5000') + '/api';

/* one public address in each country, for naming the country rather than an address */
const SAMPLE_IP = {
  ES: '88.27.0.1', PK: '39.50.0.1', US: '8.8.8.8', GB: '81.2.69.142', DE: '85.214.132.117', FR: '90.63.0.1',
  IT: '151.11.0.1', PT: '85.240.0.1', BR: '200.221.11.1', MX: '187.188.0.1', AR: '181.47.0.1', CO: '190.24.0.1',
  IN: '117.200.0.1', AE: '94.200.0.1', SA: '188.48.0.1', TR: '85.105.0.1', NL: '145.53.0.1', CA: '24.48.0.1',
  /* two Spanish regions, for the region-level lockers: Madrid and Catalonia */
  'ES-MD': '88.27.0.1', 'ES-CT': '84.88.0.1',
};
const ip = SAMPLE_IP[where.toUpperCase()] ?? where;
const username = who.replace(/^@/, '');
const loads = Math.max(1, Number(loadsArg) || 3);

async function oneLoad() {
  let total = 0;
  const mine = [];
  for (let page = 1; page <= 40; page++) {
    const r = await fetch(`${API}/world?page=${page}`, { headers: { 'X-Forwarded-For': ip } });
    if (!r.ok) throw new Error(`/world?page=${page} answered ${r.status}`);
    const items = (await r.json()).data?.items ?? [];
    const posts = items.filter((i) => i.type === 'post');
    if (posts.length === 0) break;
    total += posts.length;
    for (const p of posts) if (p.influencer?.usernameUrl === username) mine.push(`${p.id} (page ${page})`);
  }
  return { total, mine };
}

console.log(`WORLD as a reader in ${where.toUpperCase()} (${ip}), looking for @${username}:`);
for (let i = 1; i <= loads; i++) {
  const { total, mine } = await oneLoad();
  console.log(`  load ${i}: ${total} posts in the feed, @${username}: ${mine.length ? mine.length + ' → ' + mine.join(', ') : 'NOT in the feed'}`);
}
