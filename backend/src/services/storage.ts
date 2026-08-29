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

/**
 * The same thing for an ad's creative, which may be a video.
 *
 * `saveBase64Image` refuses anything that is not an image and always writes `.png`, which is
 * right for the Laravel-era image uploads it serves. A Super Ad may be a clip: the form has
 * offered `video/mp4` and `video/webm` all along, but the save rejected it, so the create
 * call 400'd and the advertiser never reached the payment page. A video keeps its own
 * extension — the feed picks the `<source type>` from it, and a clip written as `.png`
 * would be drawn as a broken picture.
 */
const MEDIA_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'png',
  'image/jpg': 'png',
  'image/webp': 'png',
  'image/gif': 'png',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/ogg': 'ogv',
};

/** The ceiling a base64 body can carry: the JSON limit is 20MB and base64 adds about a third. */
const MAX_MEDIA_BYTES = 14 * 1024 * 1024;

export async function saveBase64Media(dataUrl: string): Promise<string> {
  const match = /^data:([a-z]+\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) throw ApiError.badRequest('Invalid media data');

  const mime = match[1].toLowerCase();
  const ext = MEDIA_EXT[mime];
  if (!ext) {
    throw ApiError.badRequest(
      `${mime} is not a supported file. Use a JPG, PNG, GIF or WEBP image, or an MP4, WEBM or MOV video.`,
    );
  }

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0) throw ApiError.badRequest('The file is empty');
  if (buffer.length > MAX_MEDIA_BYTES) {
    const mb = (buffer.length / 1024 / 1024).toFixed(1);
    throw ApiError.badRequest(
      `That file is ${mb} MB. The most an ad can carry is 14 MB — please compress the video or use a shorter clip.`,
    );
  }

  /* the same name shape the image path has always used, so nothing downstream has to care */
  const filename = `image_${Math.floor(Date.now() / 1000)}${Math.floor(Math.random() * 9999) + 1}.${ext}`;
  await fs.promises.writeFile(path.join(uploadsDir(), filename), buffer);
  return filename;
}
