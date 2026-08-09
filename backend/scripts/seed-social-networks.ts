/** Seeds the socialnetworks reference table (mirrors MySQL `socialnetworks`). Idempotent. */
import 'dotenv/config';
import mongoose from 'mongoose';
import { SocialNetwork } from '../src/models/SocialNetwork.js';

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/superfans';

// [mysqlId, name, defaultAddress, image, feedImage] — exact rows from MySQL `socialnetworks`
const NETWORKS: [number, string, string, string, string][] = [
  [1, 'Twitch', 'https://www.twitch.tv/', 'twitch_.png', 'blue24Twitch.png'],
  [2, 'Instagram', 'https://instagram.com/', 'Instagram_icon.png', 'blue24Instagram.png'],
  [3, 'Youtube', 'https://www.youtube.com/', 'Youtube_logo.png', 'blue24Youtube.png'],
  [4, 'Twitter', 'https://twitter.com/', 'twitter-logo-6.png', 'blue24Twitter.png'],
  [41, 'Snapchat', 'https://www.snapchat.com/', 'Snapchat-Logotipo-2019–presente.png', 'blue24Snapchat.png'],
  [51, '21Buttons', 'https://www.21buttons.com/', 'cbd6803ce32d2bbc9b4f00a6a92932bf.jpg', 'blue2421buttons.png'],
  [61, 'Netflix', 'https://www.netflix.com/', 'netflix_logo_icon_170919.png', 'blue24Netflix.png'],
  [71, 'Spotify', 'https://www.spotify.com/', 'spotify-logoEdited.png', 'blue24Spotify.png'],
  [72, 'iTunes', 'https://www.apple.com/itunes/', 'ituneslogo.png', 'blue24itunes.png'],
  [73, 'Discord', 'https://discord.com/', 'Discord-Logo.png', 'blue24Discord.png'],
  [81, 'Amazon', 'https://www.amazon.com/', 'Logotipo-Amazon.jpg', 'blue24Amazon.png'],
  [104, 'TikTok', 'https://www.tiktok.com/', 'b05db292060a4b42799ad7abaf5d6130.png', 'blue24TikTok.png'],
];

async function main() {
  await mongoose.connect(MONGODB_URI);
  for (const [mysqlId, name, defaultAddress, image, feedImage] of NETWORKS) {
    await SocialNetwork.updateOne(
      { mysqlId },
      { $set: { name, defaultAddress, image, feedImage } },
      { upsert: true },
    );
  }
  console.log(`Seeded ${NETWORKS.length} social networks`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
