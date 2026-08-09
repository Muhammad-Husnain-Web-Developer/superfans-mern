import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;
  if (!env.SMTP_HOST) return null;
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  return transporter;
}

/**
 * Sends a mail via SMTP when configured; otherwise logs the message so the
 * flow remains fully testable in development without real credentials.
 */
export async function sendMail(to: string, subject: string, html: string): Promise<void> {
  const t = getTransporter();
  if (!t) {
    logger.info({ to, subject, html }, 'SMTP not configured — mail logged instead of sent');
    return;
  }
  await t.sendMail({ from: env.MAIL_FROM, to, subject, html });
}
