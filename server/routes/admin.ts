import { requireAdmin } from '../middleware/adminAuth.js';
import { HttpError, signLicenseToken } from '../middleware/licenseAuth.js';
import {
  getLicenseSummary,
  getUsageSummary,
  issueLicense,
  listLicenses,
  renewLicense,
  restoreLicense,
  revokeLicense
} from '../services/licenseService.js';
import type { IssueLicenseInput } from '../services/licenseService.js';
import { createCheckoutSession } from '../services/paymentService.js';
import { sendJson } from '../utils/http.js';
import type { RequestContext } from './types.js';

export function handleAdminListLicenses(context: RequestContext): void {
  requireAdmin(normalizeHeaders(context.req.headers));
  const licenses = listLicenses();
  sendJson(context.res, 200, { licenses }, { cacheControl: 'no-store' });
}

export function handleAdminIssueLicense(context: RequestContext): void {
  requireAdmin(normalizeHeaders(context.req.headers));
  const body = parseBody<IssueLicenseInput & { issueToken?: boolean; tokenExpirySeconds?: number }>(context.body);
  const summary = issueLicense(body);
  let token: string | undefined;
  let tokenExpiresAt: string | undefined;
  if (body.issueToken !== false) {
    const expiresInSeconds = body.tokenExpirySeconds ?? 60 * 60 * 24 * 30;
    token = signLicenseToken({
      licenseId: summary.licenseId,
      status: summary.status,
      tier: summary.tier,
      name: summary.ownerName
    }, { expiresInSeconds });
    tokenExpiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
  }
  sendJson(context.res, 201, { license: summary, token, tokenExpiresAt }, { cacheControl: 'no-store' });
}

export function handleAdminGetLicense(context: RequestContext): void {
  requireAdmin(normalizeHeaders(context.req.headers));
  const licenseId = context.params.licenseId;
  if (!licenseId) {
    throw new HttpError(400, 'License identifier is required.');
  }
  const summary = getLicenseSummary(licenseId);
  sendJson(context.res, 200, { license: summary }, { cacheControl: 'no-store' });
}

export function handleAdminRevokeLicense(context: RequestContext): void {
  requireAdmin(normalizeHeaders(context.req.headers));
  const licenseId = context.params.licenseId;
  if (!licenseId) {
    throw new HttpError(400, 'License identifier is required.');
  }
  const body = parseBody<{ reason?: string }>(context.body);
  const summary = revokeLicense(licenseId, body?.reason);
  sendJson(context.res, 200, { license: summary }, { cacheControl: 'no-store' });
}

export function handleAdminRestoreLicense(context: RequestContext): void {
  requireAdmin(normalizeHeaders(context.req.headers));
  const licenseId = context.params.licenseId;
  if (!licenseId) {
    throw new HttpError(400, 'License identifier is required.');
  }
  const summary = restoreLicense(licenseId);
  sendJson(context.res, 200, { license: summary }, { cacheControl: 'no-store' });
}

export function handleAdminRenewLicense(context: RequestContext): void {
  requireAdmin(normalizeHeaders(context.req.headers));
  const licenseId = context.params.licenseId;
  if (!licenseId) {
    throw new HttpError(400, 'License identifier is required.');
  }
  const body = parseBody<{ expiresAt: string; renewalReminderAt?: string }>(context.body);
  const summary = renewLicense(licenseId, {
    expiresAt: body?.expiresAt ?? '',
    renewalReminderAt: body?.renewalReminderAt
  });
  sendJson(context.res, 200, { license: summary }, { cacheControl: 'no-store' });
}

export async function handleAdminLicenseUsage(context: RequestContext): Promise<void> {
  requireAdmin(normalizeHeaders(context.req.headers));
  const licenseId = context.params.licenseId;
  if (!licenseId) {
    throw new HttpError(400, 'License identifier is required.');
  }
  const summary = getLicenseSummary(licenseId);
  const usage = getUsageSummary(licenseId);
  sendJson(context.res, 200, { license: summary, usage }, { cacheControl: 'no-store' });
}

export async function handleAdminCheckoutSession(context: RequestContext): Promise<void> {
  requireAdmin(normalizeHeaders(context.req.headers));
  const licenseId = context.params.licenseId;
  if (!licenseId) {
    throw new HttpError(400, 'License identifier is required.');
  }
  const body = parseBody<{ successUrl: string; cancelUrl: string; priceId?: string; quantity?: number; customerEmail?: string; mode?: 'payment' | 'subscription' }>(context.body);
  if (!body?.successUrl || !body.cancelUrl) {
    throw new HttpError(400, 'Both successUrl and cancelUrl are required.');
  }

  const session = await createCheckoutSession({
    licenseId,
    successUrl: body.successUrl,
    cancelUrl: body.cancelUrl,
    priceId: body.priceId,
    quantity: body.quantity,
    customerEmail: body.customerEmail,
    mode: body.mode
  });
  sendJson(context.res, 201, { session }, { cacheControl: 'no-store' });
}

function normalizeHeaders(headers: RequestContext['req']['headers']): Record<string, string | string[] | undefined> {
  const normalized: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of Object.entries(headers)) {
    normalized[key.toLowerCase()] = value;
  }
  return normalized;
}

function parseBody<T>(body: unknown): T {
  if (typeof body !== 'object' || body === null) {
    throw new HttpError(400, 'A JSON body is required for this endpoint.');
  }
  return body as T;
}
