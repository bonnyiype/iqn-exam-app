declare module 'http' {
  interface IncomingHttpHeaders {
    [key: string]: string | string[] | undefined;
  }

  interface IncomingMessage {
    headers: IncomingHttpHeaders;
    method?: string;
    url?: string | undefined;
    socket?: {
      remoteAddress?: string;
    };
    on(event: string, handler: (...args: unknown[]) => void): void;
    [Symbol.asyncIterator](): AsyncIterableIterator<string | Uint8Array>;
  }

  interface ServerResponse {
    statusCode: number;
    headersSent: boolean;
    setHeader(name: string, value: string | number): void;
    end(data?: any): void;
  }

  interface Server {
    listen(port: number, listener?: () => void): void;
  }

  function createServer(listener: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>): Server;

  export { createServer, IncomingHttpHeaders, IncomingMessage, Server, ServerResponse };
}

declare module 'crypto' {
  interface Hmac {
    update(data: string): Hmac;
    digest(encoding: 'base64url'): string;
  }

  function createHmac(algorithm: string, key: string): Hmac;
  function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean;
  function randomUUID(): string;

  export { createHmac, timingSafeEqual };
}

declare module 'fs' {
  function appendFileSync(path: string, data: string, encoding: string): void;
  function writeFileSync(path: string, data: string, encoding: string): void;
  function readFileSync(path: string, encoding: string): string;
  function existsSync(path: string): boolean;
  function mkdirSync(path: string, options: { recursive: boolean }): void;
  export { appendFileSync, writeFileSync, readFileSync, existsSync, mkdirSync };
}

declare module 'fs/promises' {
  function readFile(path: string, encoding: string): Promise<string>;
  export { readFile };
}

declare module 'path' {
  function resolve(...parts: string[]): string;
  function join(...parts: string[]): string;
  function dirname(path: string): string;
  export { resolve, join, dirname };
}

declare const Buffer: {
  from(data: string, encoding?: string): Buffer;
  from(data: Uint8Array): Buffer;
  byteLength(data: string): number;
  concat(chunks: Uint8Array[]): Buffer;
};

declare interface Buffer extends Uint8Array {
  toString(encoding?: string): string;
}

declare const process: {
  env: Record<string, string | undefined>;
  cwd(): string;
};
