import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { User } from '../models/User.js';

export const rankingsRouter = Router();

const PROJECTION = { usernameUrl: 1, profilePicture: 1, noOfFollowers: 1, verified: 1 } as const;

interface RankUser {
  usernameUrl?: string;
  profilePicture?: string;
  noOfFollowers: number;
}

function toDto(u: RankUser) {
  return {
    usernameUrl: u.usernameUrl ?? '',
    profilePicture: u.profilePicture && u.profilePicture !== 'none' ? u.profilePicture : null,
    noOfFollowers: u.noOfFollowers ?? 0,
  };
}

/**
 * Leagues — exact port of RankingController@index:
 * every list is `users ORDER BY no_of_followers DESC` with these windows —
 * superMagic 0..11, superLeague 0..50, diamond 50..150, emerald 150..250,
 * gold 250..500, silver 500..1000, bronze 1000..1004 (empty when ≤1000 users).
 */
rankingsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const sort = { noOfFollowers: -1 as const };
    const q = (skip: number, limit: number) =>
      User.find({}, PROJECTION).sort(sort).skip(skip).limit(limit).lean();

    const [superMagic, superLeague, diamondLeague, emeraldLeague, goldLeague, silverLeague, totalUsers] =
      await Promise.all([
        q(0, 11),
        q(0, 50),
        q(50, 100),
        q(150, 100),
        q(250, 250),
        q(500, 500),
        User.countDocuments(),
      ]);

    const bronzeLeague = totalUsers <= 1000 ? [] : await q(1000, 4);

    res.json({
      success: true,
      data: {
        superMagic: superMagic.map(toDto),
        superLeague: superLeague.map(toDto),
        diamondLeague: diamondLeague.map(toDto),
        emeraldLeague: emeraldLeague.map(toDto),
        goldLeague: goldLeague.map(toDto),
        silverLeague: silverLeague.map(toDto),
        bronzeLeague: bronzeLeague.map(toDto),
        totalUsers,
      },
    });
  }),
);

/** "SEE HIDDEN USERS" — port of loadMoreBronze (20 rows per click, 204 when exhausted). */
rankingsRouter.get(
  '/bronze',
  asyncHandler(async (req, res) => {
    const offset = Number(req.query.offset) || 1000;
    const total = await User.countDocuments();
    if (offset >= total) {
      res.status(204).end();
      return;
    }
    const users = await User.find({}, PROJECTION)
      .sort({ noOfFollowers: -1 })
      .skip(offset)
      .limit(20)
      .lean();
    res.json({ success: true, data: users.map(toDto), offset });
  }),
);
