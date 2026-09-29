import type { Request } from 'express';
import { ApiError } from '../middleware/errors.js';
import { PartnerRequest } from '../models/PartnerRequest.js';

/**
 * Whose account a request is acting on.
 *
 * Vinculación Partner lets a business work inside a linked account: the client's answer of
 * 29 Sep 2026 — "Yes, they can create, and do everything… with the vinculation, yes they can
 * manage it for the vinculated User/Influencer" — and his note that the work happens inside
 * Super Ads Center.
 *
 * A caller says who it is acting for by passing that account's id (`?as=` on a read,
 * `onBehalfOf` in the body of a write). The link is checked here every time, against an
 * *accepted* request and nothing weaker: a pending ask grants nothing, and one the target
 * declined or unlinked grants nothing either, so revoking access is a matter of the row
 * going away rather than of anything being cleaned up after it.
 *
 * Absent or equal to the caller, this is the caller's own id — which is what every existing
 * route already did, so passing it changes nothing for anyone not using a link.
 */
export async function actingFor(req: Request, explicit?: unknown): Promise<string> {
  const me = req.auth!.userId;
  const target = typeof explicit === 'string' && explicit.trim() ? explicit.trim() : null;
  if (!target || target === me) return me;

  const link = await PartnerRequest.findOne({
    business: me,
    target,
    status: 'accepted',
  }).lean();
  if (!link) throw ApiError.forbidden('You are not linked to that account.');
  return target;
}

/** The id named on a read — `?as=<id>`. */
export function askedFor(req: Request): unknown {
  return req.query.as;
}

/**
 * May this caller act on the account that owns something?
 *
 * The ownership checks scattered through the ads routes used to read "is this row mine"; with
 * a link they must also read "or is it an account I manage". Same rule as above: an accepted
 * link and nothing weaker.
 */
export async function mayActOn(req: Request, ownerId: unknown): Promise<boolean> {
  const me = req.auth!.userId;
  const owner = String(ownerId ?? '');
  if (!owner) return false;
  if (owner === me) return true;
  const link = await PartnerRequest.findOne({
    business: me,
    target: owner,
    status: 'accepted',
  }).lean();
  return !!link;
}
