import { env } from '../config/env.js';

/**
 * The shell every outgoing mail is wrapped in — the old design, rebuilt.
 *
 * Laravel sends through its notification layout, and the client had already put the logo
 * into that layout's header (the framework's own html/header.blade.php in vendor was edited
 * to print SuperfansT-01.png at 150px). The client asked for those mails back, with the logo
 * centred in the blue-grey field. Every value below is that theme's
 * (Illuminate/Mail/resources/views/html/themes/default.css):
 *
 *   field #edf2f7 · card 570px #ffffff, 1px #e8e5ef, radius 2px · heading #3d4852 18px
 *   text #718096 16px/1.5 · button #2d3748 with the 8/18px border padding · footer #b0adc5 12px
 *
 * Written as tables with inline styles because that is what mail clients understand —
 * Outlook has no flexbox, and <style> blocks are often stripped (the media queries below are
 * the one thing that has to live in a block, and the layout stands without them).
 */

const LOGO = 'SuperfansT-01.png';
/** the width the client's own header blade gives it */
const LOGO_WIDTH = 150;

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'";

interface MailBody {
  /** the heading above the message, e.g. "Reset Your Password" */
  title: string;
  /** paragraphs of the message; each becomes its own line */
  lines: string[];
  /** the button, when the mail asks the reader to do something */
  action?: { label: string; url: string };
  /** small print under a rule, the theme's "subcopy" */
  footnote?: string;
}

/**
 * The shell itself: the blue-grey field, the logo centred in it, the white card, the footer.
 * `content` is dropped into the card's cell.
 */
function shell(content: string): string {
  /* absolute, because a mail client has no page to resolve a relative path against */
  const origin = env.CLIENT_ORIGIN.replace(/\/+$/, '');
  const logoUrl = `${origin}/assets/images/${LOGO}`;
  const year = new Date().getFullYear();
  return DOCUMENT({ origin, logoUrl, year, content });
}

/**
 * Wrap a mail written as its own HTML — the ad and price-change mails, which reproduce their
 * blades word for word — in the same shell. The blades carry no styling of their own, so the
 * typography is set on a container here and inherited by the paragraphs inside.
 */
export function renderEmailHtml(html: string): string {
  return shell(
    `<div style="font-family:${FONT};font-size:16px;line-height:1.5em;color:#718096;text-align:left;">${html}</div>`,
  );
}

export function renderEmail({ title, lines, action, footnote }: MailBody): string {
  const body = lines
    .map(
      (line) =>
        `<p style="font-family:${FONT};font-size:16px;line-height:1.5em;margin-top:0;margin-bottom:16px;color:#718096;text-align:left;">${line}</p>`,
    )
    .join('');

  /* the theme draws the button as a link with fat single-colour borders — padding that
     Outlook will not drop */
  const button = action
    ? `<table class="action" align="center" width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:30px auto;padding:0;text-align:center;width:100%;">
         <tr><td align="center">
           <a href="${action.url}" target="_blank" rel="noopener"
              style="display:inline-block;overflow:hidden;border-radius:4px;background-color:#2d3748;border-top:8px solid #2d3748;border-bottom:8px solid #2d3748;border-left:18px solid #2d3748;border-right:18px solid #2d3748;color:#ffffff;font-family:${FONT};font-size:16px;font-weight:bold;text-decoration:none;">${action.label}</a>
         </td></tr>
       </table>`
    : '';

  const subcopy = footnote
    ? `<table class="subcopy" width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-top:1px solid #e8e5ef;margin-top:25px;padding-top:25px;">
         <tr><td>
           <p style="font-family:${FONT};font-size:14px;line-height:1.5em;margin-top:0;margin-bottom:0;color:#718096;text-align:left;">${footnote}</p>
         </td></tr>
       </table>`
    : '';

  return shell(
    `<h1 style="font-family:${FONT};color:#3d4852;font-size:18px;font-weight:bold;margin-top:0;margin-bottom:16px;text-align:left;">${title}</h1>
     ${body}
     ${button}
     ${subcopy}`,
  );
}

/** the document every mail is poured into */
function DOCUMENT({
  origin,
  logoUrl,
  year,
  content,
}: {
  origin: string;
  logoUrl: string;
  year: number;
  content: string;
}): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<style>
@media only screen and (max-width: 600px) {
  .inner-body { width: 100% !important; }
  .footer { width: 100% !important; }
}
@media only screen and (max-width: 500px) {
  .button { width: 100% !important; }
}
</style>
</head>
<body style="-webkit-text-size-adjust:none;background-color:#edf2f7;color:#718096;font-family:${FONT};height:100%;line-height:1.4;margin:0;padding:0;width:100% !important;">

<table class="wrapper" width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#edf2f7;margin:0;padding:0;width:100%;">
<tr>
<td align="center">
<table class="content" width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0;padding:0;width:100%;">

  <!-- Header: the logo, centred in the blue-grey field -->
  <tr>
    <td class="header" style="padding:25px 0;text-align:center;">
      <a href="${origin}" style="display:inline-block;">
        <img src="${logoUrl}" alt="Superfans World" width="${LOGO_WIDTH}" style="border:none;max-width:100%;width:${LOGO_WIDTH}px;height:auto;display:inline-block;">
      </a>
    </td>
  </tr>

  <!-- Body -->
  <tr>
    <td class="body" width="100%" cellpadding="0" cellspacing="0" style="background-color:#edf2f7;border-bottom:1px solid #edf2f7;border-top:1px solid #edf2f7;margin:0;padding:0;width:100%;">
      <table class="inner-body" align="center" width="570" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#ffffff;border-color:#e8e5ef;border-style:solid;border-width:1px;border-radius:2px;box-shadow:0 2px 0 rgba(0,0,150,0.025),2px 4px 0 rgba(0,0,150,0.015);margin:0 auto;padding:0;width:570px;">
        <tr>
          <td class="content-cell" style="max-width:100vw;padding:32px;">
            ${content}
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td>
      <table class="footer" align="center" width="570" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;padding:0;text-align:center;width:570px;">
        <tr>
          <td class="content-cell" align="center" style="max-width:100vw;padding:32px;">
            <p style="font-family:${FONT};color:#b0adc5;font-size:12px;line-height:1.5em;margin-top:0;margin-bottom:0;text-align:center;">
              &copy; ${year} Superfans World. All rights reserved.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

</table>
</td>
</tr>
</table>
</body>
</html>`;
}
