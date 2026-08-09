import { z } from 'zod';

/**
 * Mirrors the Laravel registration validators:
 * - fan/creator (RegisterController): name, email, password(min 8, confirmed),
 *   Choose_username_or_URL, terms, optional networks/referral/categories
 * - business (BuisnessController): company fields
 */

const baseRegister = {
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  password: z.string().min(8).max(255),
  acceptedTerms: z.literal(true, { error: 'Terms must be accepted' }),
  // Filenames returned by /api/uploads/* (pre-uploaded, like Laravel's session flow)
  profilePicture: z
    .string()
    .regex(/^image_\d+\d*\.png$/)
    .optional(),
  coverPicture: z
    .string()
    .regex(/^image_\d+\d*\.png$/)
    .optional(),
};

export const registerFanSchema = z.object({
  ...baseRegister,
  role: z.literal('user'),
  usernameUrl: z
    .string()
    .min(1)
    .max(200)
    .transform((s) => s.trim().replace(/\s+/g, '_')), // Laravel: spaces → underscores
  networks: z.array(z.string()).optional().default([]),
  networkProfileLinks: z.array(z.string()).optional().default([]),
  referredInfluencer: z.string().optional(),
});

export const registerFanFullSchema = registerFanSchema.extend({
  categories: z.array(z.string()).optional().default([]),
});

export const registerCreatorSchema = registerFanSchema.extend({
  role: z.literal('influencer'),
  categories: z.array(z.string()).optional().default([]),
  number: z.string().optional(),
  phone: z.string().optional(),
  bankAccount: z.string().optional(),
  paypalAccount: z.string().optional(),
  priceOfSubscription: z.coerce.number().min(0).optional(),
});

// Mirrors business_register.blade.php: DNI + address required, company fields optional
export const registerBusinessSchema = z.object({
  ...baseRegister,
  role: z.literal('business'),
  surname: z.string().optional(),
  dni: z.string().min(1).max(255),
  companyName: z.string().max(255).optional(),
  companyId: z.string().max(255).optional(),
  address: z.string().min(1).max(255),
  number: z.string().optional(),
  phone: z.string().optional(),
  usernameUrl: z
    .string()
    .min(1)
    .max(200)
    .transform((s) => s.trim().replace(/\s+/g, '_')),
});

export const registerSchema = z.discriminatedUnion('role', [
  registerFanFullSchema,
  registerCreatorSchema,
  registerBusinessSchema,
]);

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
