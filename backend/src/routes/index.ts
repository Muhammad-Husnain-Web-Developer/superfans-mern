import { Router } from 'express';
import mongoose from 'mongoose';
import { authRouter } from './auth.routes.js';
import { uploadsRouter } from './uploads.routes.js';
import { profilesRouter } from './profiles.routes.js';
import { usersRouter } from './users.routes.js';
import { postsRouter } from './posts.routes.js';
import { worldRouter } from './world.routes.js';
import { rankingsRouter } from './rankings.routes.js';
import { meRouter } from './me.routes.js';
import { streamRouter } from './stream.routes.js';
import { merchandisingRouter } from './merchandising.routes.js';
import { paymentsRouter } from './payments.routes.js';
import { newsRouter } from './news.routes.js';
import { chatRouter } from './chat.routes.js';
import { adsRouter } from './ads.routes.js';
import { adminRouter } from './admin.routes.js';
import { SocialNetwork } from '../models/SocialNetwork.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/uploads', uploadsRouter);
apiRouter.use('/profiles', profilesRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/posts', postsRouter);
apiRouter.use('/world', worldRouter);
apiRouter.use('/rankings', rankingsRouter);
apiRouter.use('/me', meRouter);
apiRouter.use('/merchandising', merchandisingRouter);
apiRouter.use('/payments', paymentsRouter);
apiRouter.use('/news', newsRouter);
apiRouter.use('/chatbox', chatRouter);
apiRouter.use('/ads', adsRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/', streamRouter);

// Random active ads for feed injection (mirrors Laravel: ads where status=1, inRandomOrder, take N)
apiRouter.get(
  '/ads/random',
  asyncHandler(async (req, res) => {
    const count = Math.min(Number(req.query.count) || 5, 20);
    const { Ad } = await import('../models/Ad.js');
    const ads = await Ad.aggregate<{ media: string; link?: string; mysqlId: number }>([
      { $match: { status: true } },
      { $sample: { size: count } },
      { $project: { media: 1, link: 1, mysqlId: 1 } },
    ]);
    res.json({ success: true, data: ads.map((a) => ({ id: a.mysqlId, media: a.media, link: a.link ?? '#' })) });
  }),
);

// Reference data for the registration forms (mirrors MySQL `socialnetworks`)
apiRouter.get(
  '/social-networks',
  asyncHandler(async (_req, res) => {
    const networks = await SocialNetwork.find().sort({ mysqlId: 1 }).lean();
    res.json({
      success: true,
      data: networks.map((n) => ({ id: n.mysqlId, name: n.name, defaultAddress: n.defaultAddress })),
    });
  }),
);

apiRouter.get('/health', (_req, res) => {
  const dbState = ['disconnected', 'connected', 'connecting', 'disconnecting'][
    mongoose.connection.readyState
  ];
  res.json({
    success: true,
    service: 'superfans-api',
    db: dbState,
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Upcoming milestone routers:
// M2: apiRouter.use('/users', usersRouter)
// M3: apiRouter.use('/posts', postsRouter)
