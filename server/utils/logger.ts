import fs from 'fs';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_FILE = process.env.LOG_FILE ? process.env.LOG_FILE.trim() : '';

function write(line: string) {
  if (LOG_FILE) {
    try {
      fs.appendFileSync(LOG_FILE, `${line}\n`, 'utf8');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to append log file entry', error);
    }
  }

  // eslint-disable-next-line no-console
  console.log(line);
}

export function log(level: LogLevel, message: string, metadata: Record<string, unknown> = {}): void {
  const entry = {
    level,
    message,
    time: new Date().toISOString(),
    ...metadata
  };

  write(JSON.stringify(entry));
}

export function logError(error: unknown, metadata: Record<string, unknown> = {}): void {
  if (error instanceof Error) {
    log('error', error.message, {
      stack: error.stack,
      ...metadata
    });
  } else {
    log('error', 'Unknown error', {
      error,
      ...metadata
    });
  }
}

export function logRequest(
  method: string,
  url: string,
  statusCode: number,
  durationMs: number,
  extra: Record<string, unknown> = {}
): void {
  log('info', `${method.toUpperCase()} ${url} ${statusCode}`, {
    durationMs,
    statusCode,
    method: method.toUpperCase(),
    url,
    ...extra
  });
}
