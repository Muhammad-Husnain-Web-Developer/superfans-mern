import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/errors.js';
import { News } from '../models/News.js';
import { saveBase64Image } from '../services/storage.js';

export const newsRouter = Router();

const bodySchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  status: z.enum(['active', 'paused']).default('active'),
  buttonText: z.string().max(255).optional().nullable(),
  buttonLink: z.string().max(255).optional().nullable(),
  /** optional base64 data URL for a new image */
  image: z.string().optional().nullable(),
});

function serialize(n: {
  _id: unknown;
  title: string;
  content: string;
  image?: string;
  status: string;
  buttonText?: string;
  buttonLink?: string;
  createdAt: Date;
}) {
  return {
    id: String(n._id),
    title: n.title,
    content: n.content,
    image: n.image ?? null,
    status: n.status,
    buttonText: n.buttonText ?? null,
    buttonLink: n.buttonLink ?? null,
    createdAt: n.createdAt,
  };
}

/** newsIndex — newest first. */
newsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const news = await News.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: news.map(serialize) });
  }),
);

newsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const item = await News.findById(req.params.id).lean();
    if (!item) throw ApiError.notFound('News not found');
    res.json({ success: true, data: serialize(item) });
  }),
);

/** newsStore — create (image optional). */
newsRouter.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = bodySchema.parse(req.body);
    const image = input.image ? await saveBase64Image(input.image) : undefined;
    const item = await News.create({
      title: input.title,
      content: input.content,
      status: input.status,
      buttonText: input.buttonText ?? undefined,
      buttonLink: input.buttonLink ?? undefined,
      image,
    });
    res.status(201).json({ success: true, data: serialize(item) });
  }),
);

/** newsUpdate — keeps the old image unless a new one is sent. */
newsRouter.patch(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = bodySchema.parse(req.body);
    const item = await News.findById(req.params.id);
    if (!item) throw ApiError.notFound('News not found');

    item.title = input.title;
    item.content = input.content;
    item.status = input.status;
    item.buttonText = input.buttonText ?? undefined;
    item.buttonLink = input.buttonLink ?? undefined;
    if (input.image) item.image = await saveBase64Image(input.image);
    await item.save();
    res.json({ success: true, data: serialize(item) });
  }),
);

/** newsDelete */
newsRouter.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    await News.deleteOne({ _id: req.params.id });
    res.json({ success: true, message: 'News deleted' });
  }),
);
