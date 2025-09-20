import { HttpError } from './licenseAuth.js';

const ADMIN_TOKEN = process.env.ADMIN_API_KEY?.trim();

export function requireAdmin(headers: Record<string, string | string[] | undefined>): void {
  if (!ADMIN_TOKEN) {
    throw new HttpError(500, 'Admin access token is not configured.');
  }
  const provided = extractHeader(headers, 'x-admin-token');
  if (!provided || provided !== ADMIN_TOKEN) {
    throw new HttpError(401, 'Admin authorization is required for this endpoint.');
  }
}

function extractHeader(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const raw = headers[name];
  if (Array.isArray(raw)) {
    return raw[0];
  }
  return typeof raw === 'string' ? raw : undefined;
}
