import dns from 'node:dns';
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

/**
 * Some hosts advertise an AAAA record for the SMTP host that is not actually routable from
 * where this runs — Node's default DNS order then tries IPv6 first and the connection fails
 * with ENETUNREACH, even though the same host answers instantly over IPv4. Found while testing
 * the 16 Sep price-rise mail: every outgoing mail shares the one transporter below, so an
 * unroutable IPv6 path would silently kill all of them, not just this one — sendMail's own
 * caller sites swallow the error (`.catch(() => undefined)`), so nothing would ever surface it.
 * `ipv4first` is Node's own documented fix for this exact symptom (Node ≥17).
 */
dns.setDefaultResultOrder('ipv4first');

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
