import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import * as auth from '../controllers/auth.controller.js';

export const authRouter = Router();

authRouter.post('/register', asyncHandler(auth.register));
authRouter.post('/login', asyncHandler(auth.login));
authRouter.post('/refresh', asyncHandler(auth.refresh));
authRouter.post('/logout', asyncHandler(auth.logout));
authRouter.get('/me', requireAuth, asyncHandler(auth.me));
authRouter.post('/forgot-password', asyncHandler(auth.forgotPassword));
authRouter.post('/reset-password', asyncHandler(auth.resetPassword));
