import { env } from '../config/env.js';
import { renderEmailHtml } from './emailTemplate.js';

/**
 * The six mails the blade sends around ads and price changes, which the rewrite
 * had not carried over.
 *
 * Each one reproduces its blade word for word -- resources/views/emails/*.blade.php
 * -- including the wording, the ordering of the details and the sign-offs, since
 * the client reads these closely. The subjects come from the Mailable classes in
 * app/Mail; NotifyUserPriceIncreaseMail sets none, so Laravel falls back to the
 * humanised class name, and that is the subject used here.
 */

/** `number_format($n)` — thousands separated, no decimals. */
const n0 = (v: number) => Math.round(v).toLocaleString('en-US');
/** `number_format($n, 2)` — thousands separated, two decimals. */
const n2 = (v: number) =>
  v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** `ucfirst()` */
const ucfirst = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const origin = () => env.CLIENT_ORIGIN.replace(/\/+$/, '');

export interface Mail {
  subject: string;
  html: string;
}

/** emails/ad_created_user.blade.php */
export function adCreatedUser(a: { name: string; adType: string; amount: number }): Mail {
  return {
    subject: 'Your ad has been created',
    html: renderEmailHtml(`<p>Dear ${a.name},</p>

<p>
    We are pleased to inform you that your ad of type
    <strong>"${a.adType}"</strong> has been successfully submitted and is now under review.
    Our team will verify the details and confirm approval within 48 hours.
</p>

<p>
    <strong>Ad Amount:</strong> $${n0(a.amount)}
</p>

<p>
    If your ad is not approved, the full amount will be refunded within 2 business days.
</p>

<p>
    If you have any questions or would like to make changes, please feel free to contact our support team anytime.
</p>

<p>
    Warm regards,<br>
    <strong>The Superfans Team</strong>
</p>`),
  };
}

/** emails/ad_created_admin.blade.php */
export function adCreatedAdmin(a: {
  adType: string;
  amount: number;
  userName: string;
  userEmail: string;
}): Mail {
  return {
    subject: 'New ad submitted for approval',
    html: renderEmailHtml(`<p>Hello Admin,</p>

<p>
A new ad has been submitted and is awaiting your review and approval.
Below are the details:
</p>

<p>
<strong>Ad Type:</strong> ${a.adType} <br>
<strong>Amount:</strong> $${n0(a.amount)} <br>
<strong>Submitted By:</strong> ${a.userName} (${a.userEmail})
</p>

<p>
Please review the ad at your earliest convenience:<br>
<a href="${origin()}/super-ads/all-ads"
   style="color:#3366cc; text-decoration:underline;">
    Review Pending Ads
</a>
</p>

<p>
Best regards,<br>
<strong>Superfans Team</strong>
</p>`),
  };
}

/**
 * The Super Video card's VERIFICATE button.
 *
 * No blade for this one: the button is a `mailto:` in Laravel — and a broken one, written
 * `mailto:martinherrada` with no domain, so it opened nothing anywhere. Even repaired, a
 * mailto only works on a machine with a mail client set up, and it leaves the client
 * trusting that the advertiser actually pressed Send. This carries the request itself.
 */
export function vipAccessRequestAdmin(a: {
  userName: string;
  userEmail: string;
  role: string;
}): Mail {
  return {
    subject: 'VIP Business Account Request – Super Video Ads',
    html: renderEmailHtml(`<p>Hello Admin,</p>

<p>
An advertiser has asked to become a <strong>VIP Business Account</strong> so they can
activate Super Video Ads and the other special tools.
</p>

<p>
<strong>Requested By:</strong> ${a.userName} (${a.userEmail}) <br>
<strong>Account Type:</strong> ${ucfirst(a.role)}
</p>

<p>
They are waiting on you to enable it:<br>
<a href="${origin()}/admin/users"
   style="color:#3366cc; text-decoration:underline;">
    Open the users panel
</a>
</p>

<p>
Best regards,<br>
<strong>Superfans Team</strong>
</p>`),
  };
}

/** emails/ad_payment_success_user.blade.php */
export function adPaymentSuccessUser(a: {
  name: string;
  adType: string;
  linkUrl: string | null;
  amount: number;
  durationDays: number | string;
}): Mail {
  const link = a.linkUrl ? `<a href="${a.linkUrl}">${a.linkUrl}</a>` : '—';
  return {
    subject: 'Your Ad payment was successful',
    html: renderEmailHtml(`<p>Dear ${a.name || 'User'},</p>

<p>You paid successfully for the Ad. Our team are checking your Ads. After review it will be posted on the World in 48 hours. If the Ad is rejected, you'll receive your amount back in 5 work days.</p>

<p><strong>Your Ad details:</strong></p>

<ul>
    <li><strong>Account name:</strong> ${a.name || '—'}</li>
    <li><strong>Type of ad:</strong> ${a.adType}</li>
    <li><strong>Link URL to publish:</strong> ${link}</li>
    <li><strong>Amount paid:</strong> $${n2(a.amount)}</li>
    <li><strong>Duration (days):</strong> ${a.durationDays}</li>
</ul>

<p>If you have any questions, please contact our support team.</p>

<p>Warm regards,<br><strong>The Super Ads Team</strong></p>`),
  };
}

/** emails/ad_payment_success_admin.blade.php */
export function adPaymentSuccessAdmin(a: {
  name: string;
  email: string;
  role: string;
  adType: string;
  linkUrl: string | null;
  amount: number;
  durationDays: number | string;
}): Mail {
  const link = a.linkUrl ? `<a href="${a.linkUrl}">${a.linkUrl}</a>` : '—';
  return {
    subject: `New Ad payment received – ${a.adType}`,
    html: renderEmailHtml(`<p>Hello Admin,</p>

<p>A new Ad payment has been received. Details below:</p>

<ul>
    <li><strong>Account name:</strong> ${a.name || '—'} (${a.email}) — ${ucfirst(a.role || 'user')}</li>
    <li><strong>Type of ad:</strong> ${a.adType || '—'}</li>
    <li><strong>Link URL to publish:</strong> ${link}</li>
    <li><strong>Amount:</strong> $${n2(a.amount)}</li>
    <li><strong>Duration (days):</strong> ${a.durationDays}</li>
</ul>

<p>Please review the ad when convenient.</p>

<p>Best regards,<br><strong>Super Ads</strong></p>`),
  };
}

/** emails/ad-status-changed.blade.php */
export function adStatusChanged(a: {
  name: string;
  adId: number | string;
  adType: string;
  approved: boolean;
}): Mail {
  const body = a.approved
    ? `<p>
    We’re pleased to let you know that your ad has been approved and is now ready to run.
    If you need any adjustments or have questions about performance, feel free to reach out at any time.
</p>`
    : `<p>
    Your ad has been stopped because it appears to violate our advertising guidelines or requires adjustments to comply with our policies.
    If you believe this is an error or would like assistance resolving the issue, our support team is here to help you.
</p>`;

  return {
    subject: 'Your Ad Status Has Been Updated',
    html: renderEmailHtml(`<p>Hello ${a.name},</p>

<p>Your ad <strong>#${a.adId}</strong> has been updated.</p>

<p>
    <strong>Ad Type:</strong> ${ucfirst(a.adType)} <br>
    <strong>Status:</strong>
    ${a.approved ? 'Approved ✔' : 'Stopped ⛔'}
</p>

${body}

<p>Best regards,<br>Superfans Team</p>`),
  };
}

/**
 * emails/prince-increase.blade.php — the only blade mail carrying the logo.
 * The blade points at the SVG; mail clients do not render SVG, so the same
 * artwork is used in its PNG form.
 */
export function priceIncrease(a: { subscriberName: string; subscriptionPrice: number | string }): Mail {
  return {
    subject: 'Notify User Price Increase Mail',
    html: renderEmailHtml(`<p><strong>Subject:</strong> Update on Your Subscription Fee 🦸🏻</p>

<p>Hola ${a.subscriberName}!</p>

<p>Nos complace notificarle que el precio de la tarifa del influencer al cual está usted suscrito ha aumentado a <strong>€ ${a.subscriptionPrice}</strong>.</p>

<p>Un gusto atenderle,
    Saludos cordiales.
</p>

<p>Sophie Williams</p>
<p style="color: green">Support</p>

<div style="display: block">
    <b>SUPERFANS WORLD S.L</b>
    <br />
    <i>Mail: superfansworldapp@gmail.com</i>
    <br />
    <i>Instagram: @superfansworld</i>
    <br>

</div>`),
  };
}
