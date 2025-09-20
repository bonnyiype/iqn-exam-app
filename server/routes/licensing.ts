import type { LicenseContext } from '../middleware/licenseAuth.js';
import { assertLicenseActive, getLicenseSummary, getUsageSummary } from '../services/licenseService.js';
import { sendJson } from '../utils/http.js';
import type { RequestContext } from './types.js';

export function handleLicenseStatus(context: RequestContext, license: LicenseContext): void {
  const summary = getLicenseSummary(license.id);
  sendJson(context.res, 200, {
    license: summary,
    active: summary.status === 'active' || summary.status === 'trial',
    needsRenewal: summary.status === 'expired'
  }, { cacheControl: 'no-store' });
}

export function handleLicenseUsage(context: RequestContext, license: LicenseContext): void {
  const summary = assertLicenseActive(license.id);
  const usage = getUsageSummary(summary.licenseId);
  sendJson(context.res, 200, { summary, usage }, { cacheControl: 'no-store' });
}
