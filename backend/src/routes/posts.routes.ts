import { exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/errors.js';
import { Post } from '../models/Post.js';
import { Like } from '../models/Like.js';
import { Hate } from '../models/Hate.js';
import { PostVisit } from '../models/PostVisit.js';
import { User } from '../models/User.js';
import { Subscription } from '../models/Subscription.js';
import { Followership } from '../models/Followership.js';
import { uploadsDir } from '../services/storage.js';
import { logger } from '../config/logger.js';

const execAsync = promisify(exec);

export const postsRouter = Router();

/* Laravel add_post names the file rand(1,10) + original name into assets/images */
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir()),
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^A-Za-z0-9._-]/g, '_');
      cb(null, `${Math.floor(Math.random() * 10) + 1}${safe}`);
    },
  }),
  limits: { fileSize: 200 * 1024 * 1024 },
});

function isVideoMime(mime: string): boolean {
  return mime.startsWith('video/');
}

/** ffmpeg frame @1s, same command as Laravel's add_post; silently skipped when unavailable. */
async function generateThumbnail(videoPath: string, filename: string): Promise<string | null> {
  const thumbDir = path.join(uploadsDir(), 'thumbnails');
  fs.mkdirSync(thumbDir, { recursive: true });
  const thumbnailName = `${path.parse(filename).name}.jpg`;
  const thumbnailPath = path.join(thumbDir, thumbnailName);
  try {
    await execAsync(`ffmpeg -i "${videoPath}" -ss 00:00:01.000 -vframes 1 "${thumbnailPath}"`);
    if (fs.existsSync(thumbnailPath) && fs.statSync(thumbnailPath).size > 0) return thumbnailName;
  } catch {
    logger.info(`Thumbnail generation skipped/failed for video: ${filename} (is ffmpeg installed?)`);
  }
  return null;
}

/* ---------- create post (mirrors InfluencerController@add_post) ---------- */
postsRouter.post(
  '/',
  requireAuth,
  upload.single('postImageVideo'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('postImageVideo file is required');

    const tags = typeof req.body.tags === 'string' && req.body.tags ? String(req.body.tags).split(',') : [];
    let taggedProfilePictures: string[] = [];
    if (typeof req.body.taggedUserProfiles === 'string' && req.body.taggedUserProfiles) {
      try {
        const parsed: unknown = JSON.parse(req.body.taggedUserProfiles);
        if (Array.isArray(parsed)) {
          taggedProfilePictures = parsed
            .map((u: { profile_picture?: string }) => u.profile_picture ?? '')
            .filter(Boolean);
        }
      } catch {
        /* malformed json — same as Laravel, just skip */
      }
    }

    let thumbnail: string | null = null;
    if (isVideoMime(req.file.mimetype)) {
      thumbnail = await generateThumbnail(req.file.path, req.file.filename);
    }

    const post = await Post.create({
      influencer: req.auth!.userId,
      imageVideo: req.file.filename,
      thumbnail: thumbnail ?? undefined,
      tags,
      taggedProfilePictures,
      visible: true,
    });

    res.status(201).json({
      success: true,
      message: 'Post Added',
      data: { id: String(post._id), imageVideo: post.imageVideo, thumbnail: post.thumbnail ?? null },
    });
  }),
);

/* ---------- delete (Laravel delete_post; ownership enforced here) ---------- */
postsRouter.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const post = await Post.findById(req.params.id);
    if (!post) throw ApiError.notFound('Post not found');
    if (String(post.influencer) !== req.auth!.userId && req.auth!.role !== 'admin') {
      throw ApiError.forbidden();
    }
    await post.deleteOne();
    res.json({ success: true, message: 'Post Deleted' });
  }),
);

/* ---------- visibility toggles ---------- */
postsRouter.post(
  '/:id/toggle-visibility',
  requireAuth,
  asyncHandler(async (req, res) => {
    const post = await Post.findById(req.params.id);
    if (!post) throw ApiError.notFound('Post not found.');
    if (String(post.influencer) !== req.auth!.userId && req.auth!.role !== 'admin') {
      throw ApiError.forbidden();
    }
    post.visible = !post.visible;
    await post.save();
    res.json({ success: true, message: 'Post visibility updated.', data: { visible: post.visible } });
  }),
);

postsRouter.post(
  '/toggle-all-visibility',
  requireAuth,
  asyncHandler(async (req, res) => {
    const posts = await Post.find({ influencer: req.auth!.userId });
    if (posts.length === 0) throw ApiError.badRequest('No posts found for this influencer.');
    const allVisible = posts.every((p) => p.visible);
    const newVisibility = !allVisible;
    await Post.updateMany({ influencer: req.auth!.userId }, { $set: { visible: newVisibility } });
    res.json({
      success: true,
      message: `All posts are now set to ${newVisibility ? 'visible' : 'invisible'}.`,
      data: { visible: newVisibility },
    });
  }),
);

/* ---------- like toggle (mirrors like_dislike_post: liking removes a hate) ---------- */
postsRouter.post(
  '/:id/like-toggle',
  requireAuth,
  asyncHandler(async (req, res) => {
    const post = await Post.findById(req.params.id);
    if (!post) throw ApiError.notFound('Post not found');

    const existing = await Like.findOne({ post: post._id, user: req.auth!.userId });
    let status: 'post liked' | 'post disliked';
    if (!existing) {
      await Like.create({ post: post._id, user: req.auth!.userId });
      await Hate.deleteOne({ post: post._id, user: req.auth!.userId });
      status = 'post liked';
    } else {
      await existing.deleteOne();
      status = 'post disliked';
    }

    const [likeRows, hateRows] = await Promise.all([
      Like.countDocuments({ post: post._id }),
      Hate.countDocuments({ post: post._id }),
    ]);
    res.json({
      success: true,
      data: { status, likesTotal: likeRows + post.noOfLikes, likesCount: likeRows, hatesCount: hateRows },
    });
  }),
);

/* ---------- record a visit ---------- */
postsRouter.post(
  '/:id/visit',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const post = await Post.findById(req.params.id);
    if (!post) throw ApiError.notFound('Post not found');
    await PostVisit.create({
      post: post._id,
      user: req.auth?.userId,
      ipAddress: req.ip,
    });
    res.json({ success: true });
  }),
);

/* ---------- post detail with prev/next (mirrors post_detail) ---------- */
postsRouter.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const post = await Post.findById(req.params.id).lean();
    if (!post) throw ApiError.notFound('Post not found');

    const influencer = await User.findById(post.influencer).lean();
    /* Newest first, the order the wall and the posts grid render. The viewer used
       to walk these ascending, so scrolling down — towards the post drawn below
       the one you tapped — actually stepped backwards through the profile. */
    const siblings = await Post.find({ influencer: post.influencer }, { _id: 1 })
      .sort({ mysqlId: -1, createdAt: -1 })
      .lean();
    const idx = siblings.findIndex((s) => String(s._id) === String(post._id));
    const prevId = idx > 0 ? String(siblings[idx - 1]._id) : null;
    const nextId = idx >= 0 && idx < siblings.length - 1 ? String(siblings[idx + 1]._id) : null;

    const [likeRows, hateRows, viewerLiked, viewerHated] = await Promise.all([
      Like.countDocuments({ post: post._id }),
      Hate.countDocuments({ post: post._id }),
      req.auth ? Like.exists({ post: post._id, user: req.auth.userId }).then(Boolean) : false,
      req.auth ? Hate.exists({ post: post._id, user: req.auth.userId }).then(Boolean) : false,
    ]);

    /* A post the grids show to everyone must not turn into a lock the moment it
       is opened. post_detail.blade.php renders its media unconditionally — the
       subscription it looks up only drives the +Follow button — and both grids
       gate purely on `visible`. So a visible post is open to all; a hidden one
       still needs the owner, a subscription (influencers) or a follow (users),
       and keeps the locked tile. */
    let canView = post.visible;
    let viewerFollowing = false;
    if (req.auth && influencer) {
      if (req.auth.userId === String(influencer._id)) {
        canView = true;
      } else {
        const [sub, fol] = await Promise.all([
          Subscription.exists({ user: req.auth.userId, influencer: influencer._id }).then(Boolean),
          Followership.exists({ followerUser: req.auth.userId, followedUser: influencer._id }).then(Boolean),
        ]);
        canView = canView || (influencer.role === 'influencer' ? sub : fol);
        // "already following" = any existing relationship (drives the +Follow button visibility)
        viewerFollowing = sub || fol;
      }
    }

    res.json({
      success: true,
      data: {
        id: String(post._id),
        imageVideo: post.imageVideo ?? null,
        thumbnail: post.thumbnail ?? null,
        visible: post.visible,
        tags: post.tags,
        taggedProfilePictures: post.taggedProfilePictures,
        likesTotal: likeRows + post.noOfLikes,
        likesCount: likeRows,
        hatesCount: hateRows,
        viewerLiked,
        viewerHated,
        canView,
        viewerFollowing,
        createdAt: post.createdAt,
        prevId,
        nextId,
        influencer: influencer
          ? {
              id: String(influencer._id),
              name: influencer.name,
              usernameUrl: influencer.usernameUrl ?? null,
              profilePicture: influencer.profilePicture ?? null,
              verified: influencer.verified,
              role: influencer.role,
              priceOfSubscription: influencer.priceOfSubscription ?? null,
            }
          : null,
      },
    });
  }),
);
