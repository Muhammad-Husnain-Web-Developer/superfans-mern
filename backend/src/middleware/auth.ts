import type { NextFunction, Request, Response } from 'express';
import { ApiError } from './errors.js';
import { ACCESS_COOKIE, verifyAccessToken, type UserRole } from '../utils/jwt.js';

declare module 'express-serve-static-core' {
  interface Request {
    auth?: { userId: string; role: UserRole };
  }
}

/** Requires a valid access-token cookie. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = (req.cookies as Record<string, string | undefined>)[ACCESS_COOKIE];
  if (!token) return next(ApiError.unauthorized('Not authenticated'));
  try {
    const payload = verifyAccessToken(token);
    req.auth = { userId: payload.sub, role: payload.role };
    next();
  } catch {
    next(ApiError.unauthorized('Session expired'));
  }
}

/** Attaches req.auth when a valid token cookie is present, without requiring one. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = (req.cookies as Record<string, string | undefined>)[ACCESS_COOKIE];
  if (token) {
    try {
      const payload = verifyAccessToken(token);
      req.auth = { userId: payload.sub, role: payload.role };
    } catch {
      /* expired/invalid — treat as guest */
    }
  }
  next();
}

/** Role gate — mirrors the Laravel `admin` / `influencer` / `User` middleware. */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) return next(ApiError.unauthorized('Not authenticated'));
    if (!roles.includes(req.auth.role)) return next(ApiError.forbidden());
    next();
  };
}

/** Mirrors Laravel `not_business` middleware (blocks advertiser accounts from the social side). */
export function notBusiness(req: Request, _res: Response, next: NextFunction): void {
  if (req.auth?.role === 'business') return next(ApiError.forbidden('Business accounts cannot access this area'));
  next();
}
