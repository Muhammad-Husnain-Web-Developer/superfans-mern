import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';
import { ApiError } from '../middleware/errors.js';

/**
 * Media storage service.
 * `local` driver keeps the Laravel behavior: files land in one directory and
 * are served under /assets/images/<filename>, so legacy DB filenames keep
 * resolving. A `cloudinary` driver plugs in here for production later.
 */

export function uploadsDir(): string {
  const dir = path.resolve(env.UPLOADS_DIR);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Saves a base64 data-URL image exactly like Laravel's UploadController: image_<time><rand>.png */
export async function saveBase64Image(dataUrl: string): Promise<string> {
  const match = /^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/.exec(dataUrl);
  if (!match) throw ApiError.badRequest('Invalid image data');

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0) throw ApiError.badRequest('Empty image');
  if (buffer.length > 15 * 1024 * 1024) throw ApiError.badRequest('Image too large');

  const filename = `image_${Math.floor(Date.now() / 1000)}${Math.floor(Math.random() * 9999) + 1}.png`;
  await fs.promises.writeFile(path.join(uploadsDir(), filename), buffer);
  return filename;
}
