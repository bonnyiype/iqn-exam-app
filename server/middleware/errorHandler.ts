import http from 'http';
import { HttpError } from './licenseAuth.js';
import { logError } from '../utils/logger.js';

export function respondWithError(res: http.ServerResponse, error: unknown, route: string): void {
  if (res.headersSent) {
    res.end();
    return;
  }

  if (error instanceof HttpError) {
    res.statusCode = error.status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ error: error.status >= 500 ? 'ServerError' : 'RequestError', message: error.message }));
    return;
  }

  logError(error, { route });
  res.statusCode = 500;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const message = error instanceof Error ? error.message : 'Unexpected error';
  res.end(JSON.stringify({ error: 'ServerError', message }));
}
