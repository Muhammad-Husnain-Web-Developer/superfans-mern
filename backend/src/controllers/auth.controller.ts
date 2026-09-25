import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { User, type IUser } from '../models/User.js';
import { PasswordReset } from '../models/PasswordReset.js';
import { ApiError } from '../middleware/errors.js';
import { loginSchema, registerSchema } from '../validators/auth.schemas.js';
import { sendMail } from '../services/mailer.js';
import { renderEmail } from '../services/emailTemplate.js';
import { env } from '../config/env.js';
import {
  REFRESH_COOKIE,
  clearAuthCookies,
  setAuthCookies,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  type UserRole,
} from '../utils/jwt.js';

function publicUser(user: IUser) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    usernameUrl: user.usernameUrl ?? null,
    profilePicture: user.profilePicture ?? null,
    coverColor: user.coverColor,
    verified: user.verified,
    vip: user.vip,
    chatToggle: user.chatToggle,
    /* `!== false` rather than `?? true`: accounts created before this field existed
       have no value stored, and mongoose does not apply schema defaults on read — so a
       missing field must read as on, which is what the client asked for. */
    soundEffects: user.soundEffects !== false,
    createdAt: user.createdAt,
  };
}

function issueSession(res: Response, user: IUser): void {
  const access = signAccessToken({ sub: String(user._id), role: user.role as UserRole });
  const refresh = signRefreshToken({ sub: String(user._id) });
  setAuthCookies(res, access, refresh);
}

export async function register(req: Request, res: Response): Promise<void> {
  const input = registerSchema.parse(req.body);

  const emailTaken = await User.exists({ email: input.email.toLowerCase() });
  if (emailTaken) throw ApiError.badRequest('Email already registered');

  if ('usernameUrl' in input && input.usernameUrl) {
    const usernameTaken = await User.exists({ usernameUrl: input.usernameUrl });
    if (usernameTaken) throw ApiError.badRequest('Username already taken');
  }

  const user = await User.create({
    ...input,
    acceptedTermsAndConditions: true,
    emailVerifiedAt: new Date(), // Laravel flows auto-verified in practice
  });

  issueSession(res, user);
  res.status(201).json({ success: true, data: publicUser(user) });
}

/* The two lines LoginController.php:43,49 puts on the login form, verbatim — trailing space
   and all. They are written into the controller there, not into a lang file, so they stay
   English in every language. */
const SUSPENDED_MESSAGE =
  '⚠️ Your account has been suspended for violation of the rules of Superfans World. Contact our Support Team. ';
const DELETED_MESSAGE = 'Your account has been deleted permanently.';

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = loginSchema.parse(req.body);

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

  /* LoginController::validateLogin weighs the account's standing before the password, so a
     suspended or deleted account is told which it is even when the password is wrong. */
  if (user?.status === 'suspended') {
    throw ApiError.forbidden(SUSPENDED_MESSAGE);
  }
  if (user?.status === 'deleted') {
    throw ApiError.forbidden(DELETED_MESSAGE);
  }

  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Invalid credentials');
  }

  issueSession(res, user);
  res.json({ success: true, data: publicUser(user) });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const token = (req.cookies as Record<string, string | undefined>)[REFRESH_COOKIE];
  if (!token) throw ApiError.unauthorized('No refresh token');

  let userId: string;
  try {
    userId = verifyRefreshToken(token).sub;
  } catch {
    clearAuthCookies(res);
    throw ApiError.unauthorized('Session expired');
  }

  const user = await User.findById(userId);
  if (!user || user.status === 'suspended') {
    clearAuthCookies(res);
    throw ApiError.unauthorized('Session expired');
  }

  issueSession(res, user);
  res.json({ success: true, data: publicUser(user) });
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = await User.findById(req.auth!.userId);
  if (!user) throw ApiError.unauthorized('Account no longer exists');
  res.json({ success: true, data: publicUser(user) });
}

export async function logout(_req: Request, res: Response): Promise<void> {
  clearAuthCookies(res);
  res.json({ success: true });
}

/* ---------- password reset (mirrors Laravel's password broker) ---------- */

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = z.object({ email: z.string().email() }).parse(req.body);
  const normalized = email.toLowerCase();

  // Always answer with Laravel's status line to avoid email enumeration
  const status = 'We have emailed your password reset link!';

  const user = await User.findOne({ email: normalized });
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await PasswordReset.deleteMany({ email: normalized });
    await PasswordReset.create({ email: normalized, tokenHash });

    const link = `${env.CLIENT_ORIGIN}/password/reset/${token}?email=${encodeURIComponent(normalized)}`;
    await sendMail(
      normalized,
      'Reset Password Notification - Superfans World',
      renderEmail({
        title: 'Reset Your Password',
        lines: [
          'We received a request to reset the password for your account.',
          'Press the button below to choose a new one.',
        ],
        action: { label: 'Reset Password', url: link },
        footnote:
          'This link expires in 60 minutes. If you did not ask for a password reset, you can ignore this email — nothing will change.',
      }),
    );
  }

  res.json({ success: true, message: status });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { email, token, password } = z
    .object({
      email: z.string().email(),
      token: z.string().min(10),
      password: z.string().min(8),
    })
    .parse(req.body);

  const normalized = email.toLowerCase();
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const record = await PasswordReset.findOne({ email: normalized, tokenHash });
  if (!record) throw ApiError.badRequest('This password reset token is invalid.');

  const user = await User.findOne({ email: normalized }).select('+password');
  if (!user) throw ApiError.badRequest('This password reset token is invalid.');

  user.password = password; // hashed by the pre-save hook
  await user.save();
  await PasswordReset.deleteMany({ email: normalized });

  res.json({ success: true, message: 'Your password has been reset!' });
}