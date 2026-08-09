import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { saveBase64Image } from '../services/storage.js';

export const uploadsRouter = Router();

const bodySchema = z.object({ image: z.string().min(50) });

// Mirrors Laravel's /upload_profile_image and /upload_cover_image:
// accepts { image: <base64 data URL> }, responds { filename }
uploadsRouter.post(
  '/profile-image',
  asyncHandler(async (req, res) => {
    const { image } = bodySchema.parse(req.body);
    const filename = await saveBase64Image(image);
    res.json({ filename });
  }),
);

uploadsRouter.post(
  '/cover-image',
  asyncHandler(async (req, res) => {
    const { image } = bodySchema.parse(req.body);
    const filename = await saveBase64Image(image);
    res.json({ filename });
  }),
);
