import http from 'http';

export interface SendJsonOptions {
  cacheControl?: string;
}

export function sendJson(
  res: http.ServerResponse,
  status: number,
  body: unknown,
  options: SendJsonOptions = {}
): void {
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

export async function readRequestBody(
  req: http.IncomingMessage,
  maxBytes = 1_048_576
): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBytes) {
      throw new Error('Request body is too large.');
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function readJsonBody<T>(
  req: http.IncomingMessage,
  maxBytes = 1_048_576
): Promise<T | undefined> {
  const raw = await readRequestBody(req, maxBytes);
  if (!raw) {
    return undefined;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error('Unable to parse JSON body.');
  }
}

export function getClientIp(req: http.IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].split(',')[0].trim();
  }
  if (req.socket && req.socket.remoteAddress) {
    return req.socket.remoteAddress;
  }
  return 'unknown';
}
