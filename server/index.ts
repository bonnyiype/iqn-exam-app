import http from 'http';
import { DEV_SERVER_ORIGINS } from '../config/devServer.js';
import { buildExamQuestionsResponse } from './routes/exams.js';
import { HttpError, verifyLicense } from './middleware/licenseAuth.js';

const allowedOrigins = buildOriginSet(process.env.CLIENT_ORIGINS);

export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      applyCors(req, res);

      if (req.method === 'OPTIONS') {
        respondToPreflight(res);
        return;
      }

      const requestUrl = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

      if (req.method === 'GET' && requestUrl.pathname === '/health') {
        sendJson(res, 200, { status: 'ok' });
        return;
      }

      if (req.method === 'GET' && requestUrl.pathname === '/api/exams/questions') {
        const license = verifyLicense(req.headers);
        const payload = await buildExamQuestionsResponse(requestUrl.searchParams, license);
        sendJson(res, 200, payload, { cacheControl: 'private, max-age=300' });
        return;
      }

      sendJson(res, 404, { error: 'NotFound', message: 'Resource not found.' });
    } catch (error) {
      handleError(res, error);
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, X-License-Token, Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.end();
}

function sendJson(
  res: http.ServerResponse,
  status: number,
  body: unknown,
  options: { cacheControl?: string } = {}
) {
  if (res.headersSent) {
    return;
  }

  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Length', Buffer.byteLength(payload));

  if (options.cacheControl) {
    res.setHeader('Cache-Control', options.cacheControl);
  } else if (status >= 400) {
    res.setHeader('Cache-Control', 'no-store');
  }

  res.end(payload);
}

function handleError(res: http.ServerResponse, error: unknown) {
  if (res.headersSent) {
    res.end();
    return;
  }

  let status = 500;
  let message = 'Unexpected server error.';
  let code = 'ServerError';

  if (error instanceof HttpError) {
    status = error.status;
    message = error.message;
    code = status === 401 || status === 403 ? 'LicenseVerificationFailed' : 'ServerError';
  } else if (error instanceof Error) {
    message = error.message || message;
  }

  if (process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.error(error);
  }

  sendJson(res, status, { error: code, message });
}

function buildOriginSet(value: string | undefined): Set<string> {
  if (!value) {
    // Defaults mirror the Vite dev server origins defined in config/devServer.js.
    return new Set(DEV_SERVER_ORIGINS);
  }

  const entries = value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return new Set(entries);
}
