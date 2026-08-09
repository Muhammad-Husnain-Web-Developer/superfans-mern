import { Schema, model } from 'mongoose';

export interface IPasswordReset {
  email: string;
  tokenHash: string;
  createdAt: Date;
}

const passwordResetSchema = new Schema<IPasswordReset>({
  email: { type: String, required: true, index: true },
  tokenHash: { type: String, required: true },
  // Tokens expire after 60 minutes (Laravel's default)
  createdAt: { type: Date, default: Date.now, expires: 3600 },
});

export const PasswordReset = model<IPasswordReset>('PasswordReset', passwordResetSchema);
