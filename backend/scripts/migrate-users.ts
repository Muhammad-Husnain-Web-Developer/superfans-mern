/**
 * MySQL → MongoDB user migration (M1).
 *
 * Reads `users` from the Laravel database (superfanslaravel) and upserts into
 * MongoDB keyed by `mysqlId`, so it is idempotent and re-runnable until cutover.
 * Laravel bcrypt password hashes ($2y$) are carried over unchanged — the User
 * model normalizes the prefix on compare, so users keep their passwords.
 *
 * Usage:  npx tsx scripts/migrate-users.ts
 * Env:    MYSQL_URI (default mysql://root@127.0.0.1:3306/superfanslaravel)
 *         MONGODB_URI (from backend .env)
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';
import mongoose from 'mongoose';
import { User } from '../src/models/User.js';

const MYSQL_URI = process.env.MYSQL_URI ?? 'mysql://root@127.0.0.1:3306/superfanslaravel';
const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/superfans';

interface MysqlUser {
  id: number;
  name: string;
  surname: string | null;
  email: string;
  password: string;
  role: string | null;
  status: string | null;
  username_URL: string | null;
  email_verified_at: Date | null;
  accepted_terms_and_conditions: number;
  bio: string | null;
  profile_picture: string | null;
  cover_picture: string | null;
  cover_color: string;
  footer_name_username: string | null;
  profile_picture_border_status: string | null;
  birth: string | null;
  country: string | null;
  gender: string | null;
  nationality: string | null;
  number: string | null;
  phone: string | null;
  categories: string | null;
  Influencer_networks: string | null;
  Influencer_networks_profile_links: string | null;
  instagram_link: string | null;
  referred_influencer: string | null;
  dni: string | null;
  company_name: string | null;
  company_id: string | null;
  address: string | null;
  price_of_subscription: string | null;
  bank_account: string | null;
  paypal_account: string | null;
  earnings: number | string | null;
  external_customer_id: string | null;
  no_of_followers: number | null;
  growth_status: string | null;
  growth_gear_level: number | null;
  growth_start_time: Date | null;
  follower_growth_time: Date | null;
  vip: number | null;
  verified: number | null;
  chat_toggle: number | null;
  registered_ip: string | null;
  registered_country: string | null;
  visited_countries: string | null;
  created_at: Date | null;
  updated_at: Date | null;
}

function csv(value: string | null): string[] {
  return value
    ? value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
}

function jsonArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return csv(value);
  }
}

function toNumber(value: number | string | null): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

async function main() {
  console.log(`MySQL:   ${MYSQL_URI.replace(/:[^:@/]*@/, ':***@')}`);
  console.log(`MongoDB: ${MONGODB_URI}`);

  const mysqlConn = await mysql.createConnection(MYSQL_URI);
  await mongoose.connect(MONGODB_URI);

  const [rows] = await mysqlConn.query<mysql.RowDataPacket[]>('SELECT * FROM users');
  const users = rows as unknown as MysqlUser[];
  console.log(`Fetched ${users.length} MySQL users`);

  let migrated = 0;
  let skipped = 0;
  const seenEmails = new Set<string>();
  const seenUsernames = new Set<string>();

  for (const u of users) {
    const email = u.email?.trim().toLowerCase();
    if (!email || !u.password) {
      skipped++;
      continue;
    }
    // MySQL emails are unique, but guard against case-only duplicates
    if (seenEmails.has(email)) {
      console.warn(`  duplicate email skipped: ${email} (mysql id ${u.id})`);
      skipped++;
      continue;
    }
    seenEmails.add(email);

    const role = ['user', 'influencer', 'business', 'admin'].includes(u.role ?? '')
      ? (u.role as string)
      : 'user';

    // MySQL had no unique constraint on username_URL — de-duplicate here.
    // First occurrence keeps the name; later ones get a mysqlId suffix
    // (duplicate vanity URLs were unreachable in Laravel anyway).
    let usernameUrl = u.username_URL?.trim() || undefined;
    if (usernameUrl) {
      const key = usernameUrl.toLowerCase();
      if (seenUsernames.has(key)) {
        console.warn(`  duplicate username '${usernameUrl}' → '${usernameUrl}_${u.id}' (mysql id ${u.id})`);
        usernameUrl = `${usernameUrl}_${u.id}`;
      }
      seenUsernames.add(usernameUrl.toLowerCase());
    }

    await User.updateOne(
      { mysqlId: u.id },
      {
        $set: {
          name: u.name ?? '',
          surname: u.surname ?? undefined,
          email,
          password: u.password, // Laravel bcrypt hash, kept verbatim
          role,
          status: u.status === 'suspended' ? 'suspended' : 'active',
          usernameUrl,
          emailVerifiedAt: u.email_verified_at ?? undefined,
          acceptedTermsAndConditions: !!u.accepted_terms_and_conditions,

          bio: u.bio ?? undefined,
          profilePicture: u.profile_picture ?? undefined,
          coverPicture: u.cover_picture ?? undefined,
          coverColor: u.cover_color || 'yellow',
          footerNameUsername: u.footer_name_username ?? undefined,
          profilePictureBorderStatus: u.profile_picture_border_status ?? undefined,
          birth: u.birth ?? undefined,
          country: u.country ?? undefined,
          gender: u.gender ?? undefined,
          nationality: u.nationality ?? undefined,
          number: u.number ?? undefined,
          phone: u.phone ?? undefined,
          categories: jsonArray(u.categories),

          networks: csv(u.Influencer_networks),
          networkProfileLinks: csv(u.Influencer_networks_profile_links),
          instagramLink: u.instagram_link ?? undefined,
          referredInfluencer: u.referred_influencer ?? undefined,

          dni: u.dni ?? undefined,
          companyName: u.company_name ?? undefined,
          companyId: u.company_id ?? undefined,
          address: u.address ?? undefined,

          priceOfSubscription: toNumber(u.price_of_subscription),
          bankAccount: u.bank_account ?? undefined,
          paypalAccount: u.paypal_account ?? undefined,
          earnings: toNumber(u.earnings) ?? 0,
          externalCustomerId: u.external_customer_id ?? undefined,

          noOfFollowers: u.no_of_followers ?? 0,
          growthStatus: u.growth_status ?? undefined,
          growthGearLevel: u.growth_gear_level ?? undefined,
          growthStartTime: u.growth_start_time ?? undefined,
          followerGrowthTime: u.follower_growth_time ?? undefined,
          vip: !!u.vip,
          verified: !!u.verified,
          chatToggle: u.chat_toggle === null ? true : !!u.chat_toggle,

          registeredIp: u.registered_ip ?? undefined,
          registeredCountry: u.registered_country ?? undefined,
          visitedCountries: jsonArray(u.visited_countries),

          createdAt: u.created_at ?? new Date(),
          updatedAt: u.updated_at ?? new Date(),
        },
      },
      { upsert: true, timestamps: false },
    );
    migrated++;
    if (migrated % 500 === 0) console.log(`  ...${migrated}`);
  }

  console.log(`Done. Migrated/updated: ${migrated}, skipped: ${skipped}`);
  console.log(`MongoDB user count: ${await User.countDocuments()}`);

  await mysqlConn.end();
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
