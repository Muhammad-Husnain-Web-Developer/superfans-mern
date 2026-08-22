import { exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { Router } from 'express';
import type { Types } from 'mongoose';
import multer from 'multer';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/errors.js';
import { Story, STORY_LIFETIME_MS, STORY_MAX_VIDEO_SECONDS, type IStoryElement } from '../models/Story.js';
import { Followership } from '../models/Followership.js';
import { User } from '../models/User.js';
import { uploadsDir } from '../services/storage.js';
import { probeVideoDurationSeconds } from '../services/videoDuration.js';
import { logger } from '../config/logger.js';

const execAsync = promisify(exec);

export const storiesRouter = Router();

/* Same disk layout and naming as add_post, so stories are served by the existing
   /assets/images route with no extra plumbing. */
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir()),
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^A-Za-z0-9._-]/g, '_');
      cb(null, `story${Date.now()}_${safe}`);
    },
  }),
  /* a minute of phone video is comfortably under this; it is the outer guard, not the rule */
  limits: { fileSize: 120 * 1024 * 1024 },
});

interface StripGroup {
  _id: Types.ObjectId;
  count: number;
  latest: Date;
}

/** How many creators the feed strip carries at once. */
const STRIP_LIMIT = 50;

async function generateThumbnail(videoPath: string, filename: string): Promise<string | null> {
  const thumbDir = path.join(uploadsDir(), 'thumbnails');
  fs.mkdirSync(thumbDir, { recursive: true });
  const thumbnailName = `${path.parse(filename).name}.jpg`;
  const thumbnailPath = path.join(thumbDir, thumbnailName);
  try {
    await execAsync(`ffmpeg -i "${videoPath}" -ss 00:00:01.000 -vframes 1 "${thumbnailPath}"`);
    if (fs.existsSync(thumbnailPath) && fs.statSync(thumbnailPath).size > 0) return thumbnailName;
  } catch {
    logger.info(`Story thumbnail skipped for ${filename} (is ffmpeg installed?)`);
  }
  return null;
}

function discard(file?: Express.Multer.File): void {
  if (file) fs.promises.unlink(file.path).catch(() => undefined);
}

/* ---------------------------------------------------------------- create ---- */
/**
 * The browser measures the clip and refuses anything over a minute before it uploads, but
 * the client asked for the same rule on this side, so a request that slips past the page
 * still gets turned away. The file's own header is the authority; where the container does
 * not carry a duration (a fragmented MP4 with no mehd box) the figure the page measured is
 * the only evidence there is, and a missing one is treated as a failure, not a pass.
 */
storiesRouter.post(
  '/',
  requireAuth,
  upload.single('storyMedia'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('storyMedia file is required');

    /* A part whose Content-Type the parser could not read arrives with an empty mimetype —
       a comma inside a codecs= parameter is enough to cause it — so the name decides when
       the header cannot. */
    const mime = req.file.mimetype || '';
    const ext = path.extname(req.file.originalname).toLowerCase();
    const videoExt = ['.mp4', '.mov', '.m4v', '.webm', '.ogv', '.avi', '.mkv'];
    const imageExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.avif'];
    const isVideo = mime.startsWith('video/') || (!mime && videoExt.includes(ext));
    const isImage = mime.startsWith('image/') || (!mime && imageExt.includes(ext));
    if (!isVideo && !isImage) {
      discard(req.file);
      throw ApiError.badRequest('A story must be an image or a video');
    }

    let durationSeconds: number | undefined;
    if (isVideo) {
      const declared = Number(req.body.durationSeconds);
      const measured = await probeVideoDurationSeconds(req.file.path);
      const effective = measured ?? (Number.isFinite(declared) && declared > 0 ? declared : null);

      if (effective === null) {
        discard(req.file);
        throw ApiError.badRequest('Could not read the length of this video');
      }
      /* half a second of slack: a 60.0s clip often measures 60.04 */
      if (effective > STORY_MAX_VIDEO_SECONDS + 0.5) {
        discard(req.file);
        throw ApiError.badRequest(
          `A story video can be at most ${STORY_MAX_VIDEO_SECONDS} seconds (this one is ${Math.round(effective)}s)`,
        );
      }
      durationSeconds = effective;
    }

    let elements: IStoryElement[] = [];
    if (typeof req.body.elements === 'string' && req.body.elements) {
      try {
        const parsed: unknown = JSON.parse(req.body.elements);
        if (Array.isArray(parsed)) elements = parsed as IStoryElement[];
      } catch {
        /* malformed overlay json is dropped rather than failing the upload */
      }
    }

    const thumbnail = isVideo ? await generateThumbnail(req.file.path, req.file.filename) : null;

    const story = await Story.create({
      user: req.auth!.userId,
      imageVideo: req.file.filename,
      thumbnail: thumbnail ?? undefined,
      mediaType: isVideo ? 'video' : 'image',
      durationSeconds,
      elements,
      expiresAt: new Date(Date.now() + STORY_LIFETIME_MS),
    });

    res.status(201).json({
      success: true,
      message: 'Story Added',
      data: {
        id: String(story._id),
        imageVideo: story.imageVideo,
        thumbnail: story.thumbnail ?? null,
        mediaType: story.mediaType,
        expiresAt: story.expiresAt,
      },
    });
  }),
);

/* ------------------------------------------------------------ feed strip ---- */
/**
 * The row of ringed avatars above the feed (mockup Pas 7). Everyone's stories are visible
 * to everyone — the client's own answer — so this is not filtered by following or by a
 * subscription; the people the viewer follows are merely sorted to the front, the way the
 * mockup shows the viewer's own circle first.
 */
storiesRouter.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const now = new Date();
    const grouped = await Story.aggregate<StripGroup>([
      { $match: { expiresAt: { $gt: now } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: '$user', count: { $sum: 1 }, latest: { $first: '$createdAt' } } },
      { $sort: { latest: -1 } },
      { $limit: STRIP_LIMIT },
    ]);
    if (grouped.length === 0) {
      res.json({ success: true, data: { items: [] } });
      return;
    }

    const owners = await User.find(
      { _id: { $in: grouped.map((g) => g._id) } },
      { usernameUrl: 1, username: 1, name: 1, profilePicture: 1, verified: 1 },
    );
    const ownerMap = new Map(owners.map((o) => [String(o._id), o]));

    let followed = new Set<string>();
    if (req.auth) {
      const rows = await Followership.find(
        { followerUser: req.auth.userId, followedUser: { $in: grouped.map((g) => g._id) } },
        { followedUser: 1 },
      );
      followed = new Set(rows.map((r) => String(r.followedUser)));
    }

    const items = grouped
      .map((g) => {
        const owner = ownerMap.get(String(g._id));
        if (!owner) return null;
        return {
          user: {
            id: String(owner._id),
            usernameUrl: owner.usernameUrl ?? null,
            name: owner.name ?? null,
            profilePicture: owner.profilePicture ?? null,
            verified: owner.verified,
          },
          count: g.count,
          latestAt: g.latest,
          isSelf: req.auth ? String(owner._id) === req.auth.userId : false,
          viewerFollowing: followed.has(String(owner._id)),
        };
      })
      .filter(Boolean) as {
      user: { id: string };
      isSelf: boolean;
      viewerFollowing: boolean;
      latestAt: Date;
    }[];

    /* your own circle first, then the people you follow, then everyone else — each group
       still newest-first from the aggregation above */
    const rank = (i: { isSelf: boolean; viewerFollowing: boolean }): number =>
      i.isSelf ? 0 : i.viewerFollowing ? 1 : 2;
    items.sort((a, b) => rank(a) - rank(b));

    res.json({ success: true, data: { items } });
  }),
);

/* ------------------------------------------------- one creator's stories ---- */
/** What the viewer plays: every live story of one handle, oldest first. */
storiesRouter.get(
  '/user/:usernameUrl',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const owner = await User.findOne(
      { usernameUrl: req.params.usernameUrl },
      { usernameUrl: 1, name: 1, profilePicture: 1, verified: 1 },
    );
    if (!owner) throw ApiError.notFound('User not found');

    const stories = await Story.find({ user: owner._id, expiresAt: { $gt: new Date() } }).sort({
      createdAt: 1,
    });

    res.json({
      success: true,
      data: {
        user: {
          id: String(owner._id),
          usernameUrl: owner.usernameUrl ?? null,
          name: owner.name ?? null,
          profilePicture: owner.profilePicture ?? null,
          verified: owner.verified,
        },
        stories: stories.map((s) => ({
          id: String(s._id),
          imageVideo: s.imageVideo,
          thumbnail: s.thumbnail ?? null,
          mediaType: s.mediaType,
          durationSeconds: s.durationSeconds ?? null,
          elements: s.elements,
          createdAt: s.createdAt,
          expiresAt: s.expiresAt,
        })),
      },
    });
  }),
);

/* ------------------------------------------------------------------ view ---- */
storiesRouter.post(
  '/:id/view',
  optionalAuth,
  asyncHandler(async (req, res) => {
    await Story.updateOne({ _id: req.params.id }, { $inc: { noOfViews: 1 } });
    res.json({ success: true });
  }),
);

/* ---------------------------------------------------------------- delete ---- */
storiesRouter.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const story = await Story.findById(req.params.id);
    if (!story) throw ApiError.notFound('Story not found');
    if (String(story.user) !== req.auth!.userId && req.auth!.role !== 'admin') {
      throw ApiError.forbidden();
    }
    await story.deleteOne();
    fs.promises.unlink(path.join(uploadsDir(), story.imageVideo)).catch(() => undefined);
    res.json({ success: true, message: 'Story deleted' });
  }),
);
