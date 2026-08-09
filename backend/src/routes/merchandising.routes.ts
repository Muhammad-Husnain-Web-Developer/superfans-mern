import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ApiError } from '../middleware/errors.js';
import { User } from '../models/User.js';
import { merchProducts } from '../data/merchProducts.js';

export interface MerchProduct {
  name: string;
  color: string;
  tag: string;
  price: number;
  image: string;
  slug: string;
  extraImages?: string[];
  height?: string;
}

/** The catalogue is hardcoded in Laravel's MerchandisingController; extracted verbatim. */
const products: MerchProduct[] = merchProducts;

export const merchandisingRouter = Router();

/** MerchandisingController@index */
merchandisingRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: products });
  }),
);

/**
 * MerchandisingController@show — the product plus the influencer list the page
 * offers so a buyer can attribute the purchase to a creator.
 */
merchandisingRouter.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const product = products.find((p) => p.slug === req.params.slug);
    if (!product) throw ApiError.notFound('Product not found');

    const influencers = await User.find(
      { role: 'influencer' },
      { usernameUrl: 1, verified: 1 },
    ).lean();

    res.json({
      success: true,
      data: {
        product,
        influencers: influencers.map((u) => ({
          id: String(u._id),
          usernameUrl: u.usernameUrl ?? '',
          verified: u.verified,
        })),
      },
    });
  }),
);
