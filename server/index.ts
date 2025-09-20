import http from 'http';
import { verifyLicense } from './middleware/licenseAuth.js';
import { respondWithError } from './middleware/errorHandler.js';
import type { LicenseContext } from './middleware/licenseAuth.js';
import { handleExamQuestions } from './routes/exams.js';
import { handleLicenseStatus, handleLicenseUsage } from './routes/licensing.js';
import {
  handleAdminCheckoutSession,
  handleAdminGetLicense,
  handleAdminIssueLicense,
  handleAdminLicenseUsage,
  handleAdminListLicenses,
  handleAdminRenewLicense,
  handleAdminRestoreLicense,
  handleAdminRevokeLicense
} from './routes/admin.js';
import type { RequestContext } from './routes/types.js';
import { initializeLicenseStore } from './services/licenseService.js';
import { logRequest } from './utils/logger.js';
import { getClientIp, readJsonBody, sendJson } from './utils/http.js';
import { recordRateLimit, recordRequest, renderPrometheusMetrics } from './utils/metrics.js';
import { checkRateLimit, getRateLimitReset } from './utils/rateLimiter.js';
import { HttpError } from './middleware/licenseAuth.js';

initializeLicenseStore();

const allowedOrigins = buildOriginSet(process.env.CLIENT_ORIGINS);

interface RouteExtras {
  license?: LicenseContext;
  seatId?: string;
}

type RouteHandler = (context: RequestContext, extras: RouteExtras) => Promise<void> | void;

interface RouteDefinition {
  method: string;
  path: string;
  handler: RouteHandler;
  requireLicense?: boolean;
  parseJson?: boolean;
  rateLimit?: { windowMs: number; limit: number };
}

const DEFAULT_LIMIT = { windowMs: 60_000, limit: 60 } as const;
const ADMIN_LIMIT = { windowMs: 60_000, limit: 30 } as const;
const DOWNLOAD_LIMIT = { windowMs: 60_000, limit: 20 } as const;

const routes: RouteDefinition[] = [
  {
    method: 'GET',
    path: '/health',
    handler: (context) => {
      sendJson(context.res, 200, { status: 'ok' });
    },
    rateLimit: { windowMs: 30_000, limit: 30 }
  },
  {
    method: 'GET',
    path: '/metrics',
    handler: (context) => {
      const payload = renderPrometheusMetrics();
      context.res.statusCode = 200;
      context.res.setHeader('Content-Type', 'text/plain; version=0.0.4');
      context.res.end(payload);
    },
    rateLimit: { windowMs: 15_000, limit: 10 }
  },
  {
    method: 'GET',
    path: '/api/exams/questions',
    handler: (context, extras) => {
      const license = extras.license;
      const seatId = extras.seatId ?? license?.id ?? 'default-seat';
      if (!license) {
        throw new HttpError(401, 'A valid license token is required.');
      }
      return handleExamQuestions(context, license, seatId);
    },
    requireLicense: true,
    rateLimit: DOWNLOAD_LIMIT
  },
  {
    method: 'GET',
    path: '/api/licensing/status',
    handler: (context, extras) => {
      if (!extras.license) {
        throw new HttpError(401, 'License verification failed.');
      }
      handleLicenseStatus(context, extras.license);
    },
    requireLicense: true,
    rateLimit: DEFAULT_LIMIT
  },
  {
    method: 'GET',
    path: '/api/licensing/usage',
    handler: (context, extras) => {
      if (!extras.license) {
        throw new HttpError(401, 'License verification failed.');
      }
      handleLicenseUsage(context, extras.license);
    },
    requireLicense: true,
    rateLimit: DEFAULT_LIMIT
  },
  {
    method: 'GET',
    path: '/api/admin/licenses',
    handler: (context) => handleAdminListLicenses(context),
    rateLimit: ADMIN_LIMIT
  },
  {
    method: 'POST',
    path: '/api/admin/licenses',
    handler: (context) => handleAdminIssueLicense(context),
    parseJson: true,
    rateLimit: ADMIN_LIMIT
  },
  {
    method: 'GET',
    path: '/api/admin/licenses/:licenseId',
    handler: (context) => handleAdminGetLicense(context),
    rateLimit: ADMIN_LIMIT
  },
  {
    method: 'POST',
    path: '/api/admin/licenses/:licenseId/revoke',
    handler: (context) => handleAdminRevokeLicense(context),
    parseJson: true,
    rateLimit: ADMIN_LIMIT
  },
  {
    method: 'POST',
    path: '/api/admin/licenses/:licenseId/restore',
    handler: (context) => handleAdminRestoreLicense(context),
    rateLimit: ADMIN_LIMIT
  },
  {
    method: 'POST',
    path: '/api/admin/licenses/:licenseId/renew',
    handler: (context) => handleAdminRenewLicense(context),
    parseJson: true,
    rateLimit: ADMIN_LIMIT
  },
  {
    method: 'GET',
    path: '/api/admin/licenses/:licenseId/usage',
    handler: (context) => handleAdminLicenseUsage(context),
    rateLimit: ADMIN_LIMIT
  },
  {
    method: 'POST',
    path: '/api/admin/licenses/:licenseId/checkout',
    handler: (context) => handleAdminCheckoutSession(context),
    parseJson: true,
    rateLimit: { windowMs: 60_000, limit: 10 }
  }
];

export function createServer() {
  return http.createServer(async (req, res) => {
    const start = Date.now();
    const method = (req.method || 'GET').toUpperCase();
    let matchedRoute: RouteDefinition | null = null;
    let routePath = req.url ?? '/';

    try {
      applyCors(req, res);

      if (method === 'OPTIONS') {
        respondToPreflight(res);
        return;
      }

      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const match = findRoute(method, url.pathname);
      if (!match) {
        sendJson(res, 404, { error: 'NotFound', message: 'Resource not found.' });
        return;
      }

      matchedRoute = match.route;
      routePath = match.route.path;

      const ip = getClientIp(req);
      const rateLimitConfig = match.route.rateLimit ?? DEFAULT_LIMIT;
      const limitKey = `${match.route.path}:${ip}`;
      if (!checkRateLimit(limitKey, rateLimitConfig)) {
        recordRateLimit();
        const resetAt = getRateLimitReset(limitKey, rateLimitConfig.windowMs);
        const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
        res.setHeader('Retry-After', String(retryAfterSeconds));
        sendJson(res, 429, { error: 'RateLimited', message: 'Too many requests. Please slow down.' });
        return;
      }

      const context: RequestContext = {
        req,
        res,
        url,
        params: match.params,
        query: url.searchParams
      };

      if (match.route.parseJson) {
        try {
          context.body = await readJsonBody(req);
        } catch (error) {
          throw new HttpError(400, error instanceof Error ? error.message : 'Invalid JSON payload.');
        }
      }

      let license: LicenseContext | undefined;
      let seatId: string | undefined;
      if (match.route.requireLicense) {
        license = verifyLicense(req.headers);
        seatId = extractSeatId(req.headers, license.id);
      }

      await match.route.handler(context, { license, seatId });
    } catch (error) {
      respondWithError(res, error, routePath);
    } finally {
      const duration = Date.now() - start;
      const statusCode = res.statusCode || 500;
      const methodLabel = method;
      const routeLabel = matchedRoute ? matchedRoute.path : routePath;
      recordRequest(methodLabel, routeLabel, statusCode, duration);
      logRequest(methodLabel, routeLabel, statusCode, duration, {
        ip: getClientIp(req)
      });
    }
  });
}

if (process.env.NODE_ENV !== 'test') {
  const port = Number.parseInt(process.env.PORT || '4000', 10);
  const server = createServer();
  server.listen(port, () => {
    if (process.env.NODE_ENV !== 'test') {
      // eslint-disable-next-line no-console
      console.log(`IQN exam API listening on port ${port}`);
    }
  });
}

export default createServer;

function applyCors(req: http.IncomingMessage, res: http.ServerResponse) {
  res.setHeader('Vary', 'Origin');
  const originHeader = req.headers.origin;
  const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;
  if (!origin) {
    return;
  }
  if (allowedOrigins.size > 0 && !allowedOrigins.has(origin)) {
    throw new HttpError(403, 'Origin not allowed by CORS policy.');
  }
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

function respondToPreflight(res: http.ServerResponse) {
  res.statusCode = 204;
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, X-License-Token, X-Seat-Id, X-Admin-Token, Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.end();
}

function findRoute(method: string, pathname: string): { route: RouteDefinition; params: Record<string, string> } | null {
  for (const route of routes) {
    if (route.method !== method) {
      continue;
    }
    const params = matchPath(route.path, pathname);
    if (params) {
      return { route, params };
    }
  }
  return null;
}

function matchPath(routePath: string, actualPath: string): Record<string, string> | null {
  const cleanRoute = normalizePath(routePath);
  const cleanActual = normalizePath(actualPath);
  const routeParts = cleanRoute.split('/');
  const actualParts = cleanActual.split('/');

  if (routeParts.length !== actualParts.length) {
    return null;
  }

  const params: Record<string, string> = {};
  for (let index = 0; index < routeParts.length; index += 1) {
    const routePart = routeParts[index];
    const actualPart = actualParts[index];
    if (routePart.startsWith(':')) {
      const key = routePart.slice(1);
      params[key] = decodeURIComponent(actualPart);
      continue;
    }
    if (routePart !== actualPart) {
      return null;
    }
  }
  return params;
}

function normalizePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  if (!trimmed) {
    return '';
  }
  return trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
}

function extractSeatId(headers: http.IncomingHttpHeaders, fallback: string): string {
  const seatHeader = headers['x-seat-id'] || headers['x-license-seat'];
  if (Array.isArray(seatHeader)) {
    for (const entry of seatHeader) {
      if (entry && entry.trim()) {
        return entry.trim();
      }
    }
  } else if (typeof seatHeader === 'string' && seatHeader.trim()) {
    return seatHeader.trim();
  }
  return `${fallback}-seat`;
}

function buildOriginSet(value: string | undefined): Set<string> {
  if (!value) {
    return new Set(['http://localhost:5173', 'http://127.0.0.1:5173']);
  }
  const entries = value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return new Set(entries);
}
