import { env } from '../config/env.js';

/**
 * The shell every outgoing mail is wrapped in.
 *
 * Laravel sends through its own notification layout, which puts the app name in
 * a header, sets the body on a white card and draws the call to action as a
 * button. Ours went out as bare <p> tags with a plain link, which is the
 * "missing logo" the client reported. This carries the logo the price-increase
 * blade uses, in the PNG form of it: mail clients do not render SVG.
 *
 * Written as tables with inline styles because that is what mail clients
 * understand -- Outlook has no flexbox, and <style> blocks are often stripped.
 */

const LOGO = 'SuperfansT-01.png';

interface MailBody {
  /** the heading above the message, e.g. "Reset Your Password" */
  title: string;
  /** paragraphs of the message; each becomes its own line */
  lines: string[];
  /** the button, when the mail asks the reader to do something */
  action?: { label: string; url: string };
  /** small print under the button */
  footnote?: string;
}

export function renderEmail({ title, lines, action, footnote }: MailBody): string {
  /* absolute, because a mail client has no page to resolve a relative path
     against */
  const origin = env.CLIENT_ORIGIN.replace(/\/+$/, '');
  const logoUrl = `${origin}/assets/images/${LOGO}`;
  const year = new Date().getFullYear();

  const body = lines
    .map(
      (line) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#333;">${line}</p>`,
    )
    .join('');

  const button = action
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0;">
         <tr><td align="center" bgcolor="#7500a8" style="border-radius:6px;">
           <a href="${action.url}" style="display:inline-block;padding:13px 30px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:6px;">${action.label}</a>
         </td></tr>
       </table>`
    : '';

  const small = footnote
    ? `<p style="margin:22px 0 0;font-size:12px;line-height:1.6;color:#888;">${footnote}</p>`
    : '';

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f4f7;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f4f4f7;padding:26px 12px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;">

        <tr><td align="center" style="padding:6px 0 20px;">
          <a href="${origin}"><img src="${logoUrl}" width="180" alt="Superfans World" style="display:block;border:0;width:180px;height:auto;"></a>
        </td></tr>

        <tr><td style="background:#ffffff;border-radius:10px;padding:32px 30px;">
          <h1 style="margin:0 0 18px;font-size:21px;line-height:1.3;color:#111;">${title}</h1>
          ${body}
          ${button}
          ${small}
        </td></tr>

        <tr><td align="center" style="padding:18px 0 4px;font-size:12px;color:#999;">
          &copy; ${year} Superfans World
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
