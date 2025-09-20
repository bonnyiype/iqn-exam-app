import crypto from 'crypto';
import type { IncomingHttpHeaders } from 'http';

export interface LicenseClaims {
  licenseId: string;
  status?: string;
  name?: string;
  tier?: string;
  exp?: number;
  aud?: string | string[];
  iss?: string;
}

export interface LicenseContext {
  id: string;
  status: string;
  name?: string;
  tier?: string;
}

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const DEFAULT_SECRET = 'replace-this-secret';
const SECRET = (process.env.LICENSE_JWT_SECRET || DEFAULT_SECRET).trim();
const AUDIENCE = parseList(process.env.LICENSE_JWT_AUDIENCE || 'iqn-exam-app');
const ISSUER = (process.env.LICENSE_JWT_ISSUER || 'iqn-licensing-service').trim();
const ALLOWED_LICENSES = parseList(process.env.LICENSE_ALLOWED_KEYS);
const ACCEPTED_STATUSES = new Set(['active', 'trial']);
const COOKIE_NAMES = ['license_token', 'iqn_license_token', 'iqnLicense'];
const HEADER_TOKEN_NAMES = ['x-license-token', 'x-license'];

export function verifyLicense(headers: IncomingHttpHeaders): LicenseContext {
  const token = extractToken(headers);
  if (!token) {
    throw new HttpError(401, 'A signed license token is required to request IQN exam questions.');
  }

  const claims = verifyJwt(token);

  const licenseId = typeof claims.licenseId === 'string' ? claims.licenseId.trim() : '';
  if (!licenseId) {
    throw new HttpError(403, 'License token is missing the required "licenseId" claim.');
  }

  if (ALLOWED_LICENSES.size > 0 && !ALLOWED_LICENSES.has(licenseId)) {
    throw new HttpError(403, 'This license is not authorized to access IQN content.');
  }

  const statusValue = typeof claims.status === 'string' ? claims.status.trim().toLowerCase() : 'active';
  const status = ACCEPTED_STATUSES.has(statusValue) ? statusValue : 'active';
  if (claims.status && !ACCEPTED_STATUSES.has(statusValue)) {
    throw new HttpError(403, 'The supplied license is not active.');
  }

  return {
    id: licenseId,
    status,
    name: typeof claims.name === 'string' ? claims.name : undefined,
    tier: typeof claims.tier === 'string' ? claims.tier : undefined
  };
}

function extractToken(headers: IncomingHttpHeaders): string | undefined {
  const authorization = headerValue(headers, 'authorization');
  if (authorization) {
    const bearer = parseBearer(authorization);
    if (bearer) {
      return bearer;
    }
  }

  for (const headerName of HEADER_TOKEN_NAMES) {
    const headerToken = headerValue(headers, headerName);
    if (headerToken && headerToken.trim().length > 0) {
      return headerToken.trim();
    }
  }

  const cookieHeader = headerValue(headers, 'cookie');
  if (cookieHeader) {
    const cookies = parseCookies(cookieHeader);
    for (const name of COOKIE_NAMES) {
      const value = cookies.get(name);
      if (value) {
        return value;
      }
    }
  }

  return undefined;
}

function verifyJwt(token: string): LicenseClaims {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new HttpError(401, 'Invalid license token format.');
  }

  const [headerEncoded, payloadEncoded, signatureEncoded] = parts;

  const headerJson = decodeSegment(headerEncoded, 'header');
  const payloadJson = decodeSegment(payloadEncoded, 'payload');

  let header: { alg?: string; typ?: string };
  let payload: LicenseClaims;

  try {
    header = JSON.parse(headerJson) as { alg?: string; typ?: string };
  } catch {
    throw new HttpError(401, 'Unable to parse license token header.');
  }

  try {
    payload = JSON.parse(payloadJson) as LicenseClaims;
  } catch {
    throw new HttpError(401, 'Unable to parse license token payload.');
  }

  if ((header.alg || '').toUpperCase() !== 'HS256') {
    throw new HttpError(403, 'Unsupported license token algorithm.');
  }

  const expectedSignature = createSignature(headerEncoded, payloadEncoded);
  if (!secureCompare(signatureEncoded, expectedSignature)) {
    throw new HttpError(401, 'License token signature mismatch.');
  }

  if (typeof payload.exp === 'number') {
    const now = Math.floor(Date.now() / 1000);
    if (now >= payload.exp) {
      throw new HttpError(401, 'The license token has expired. Please sign in again.');
    }
  }

  if (!validateAudience(payload.aud)) {
    throw new HttpError(403, 'License token audience is not accepted.');
  }

  if (ISSUER && typeof payload.iss === 'string' && payload.iss.trim() && payload.iss !== ISSUER) {
    throw new HttpError(403, 'License token issuer is invalid.');
  }

  return payload;
}

export interface SignLicenseTokenOptions {
  expiresInSeconds?: number;
  audience?: string | string[];
  issuer?: string;
}

export function signLicenseToken(
  claims: LicenseClaims & { licenseId: string },
  options: SignLicenseTokenOptions = {}
): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload: LicenseClaims = {
    ...claims
  };

  if (!payload.iss) {
    payload.iss = options.issuer ?? ISSUER;
  } else if (options.issuer) {
    payload.iss = options.issuer;
  }

  if (!payload.aud) {
    if (options.audience) {
      payload.aud = options.audience;
    } else if (AUDIENCE.size > 0) {
      payload.aud = Array.from(AUDIENCE);
    }
  } else if (options.audience) {
    payload.aud = options.audience;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!payload.exp) {
    const expiresIn = options.expiresInSeconds ?? 60 * 60 * 24 * 30;
    payload.exp = nowSeconds + expiresIn;
  }

  const headerEncoded = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createSignature(headerEncoded, payloadEncoded);
  return `${headerEncoded}.${payloadEncoded}.${signature}`;
}

function createSignature(header: string, payload: string): string {
  return crypto.createHmac('sha256', SECRET).update(`${header}.${payload}`).digest('base64url');
}

function secureCompare(actual: string, expected: string): boolean {
  let actualBuffer: Buffer;
  let expectedBuffer: Buffer;

  try {
    actualBuffer = Buffer.from(actual, 'base64url');
    expectedBuffer = Buffer.from(expected, 'base64url');
  } catch {
    return false;
  }

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function decodeSegment(segment: string, label: string): string {
  try {
    return Buffer.from(segment, 'base64url').toString('utf8');
  } catch {
    throw new HttpError(401, `Invalid license token ${label} encoding.`);
  }
}

function validateAudience(audience: unknown): boolean {
  if (AUDIENCE.size === 0) {
    return true;
  }

  if (typeof audience === 'string') {
    return AUDIENCE.has(audience);
  }

  if (Array.isArray(audience)) {
    return audience.some((entry) => typeof entry === 'string' && AUDIENCE.has(entry));
  }

  return false;
}

function headerValue(headers: IncomingHttpHeaders, name: string): string | undefined {
  const value = headers[name.toLowerCase() as keyof IncomingHttpHeaders];
  if (Array.isArray(value)) {
    return value[0];
  }
  return typeof value === 'string' ? value : undefined;
}

function parseCookies(header: string): Map<string, string> {
  const cookies = new Map<string, string>();
  header.split(';').forEach((part) => {
    const [name, ...rest] = part.split('=');
    if (!name) return;
    const value = rest.join('=').trim();
    cookies.set(name.trim(), value);
  });
  return cookies;
}

function parseBearer(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) {
    return undefined;
  }
  const token = trimmed.slice(7).trim();
  return token.length > 0 ? token : undefined;
}

function parseList(value: string | undefined): Set<string> {
  if (!value) {
    return new Set();
  }

  return new Set(
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
  );
}
