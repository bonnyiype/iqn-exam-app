declare module 'http' {
  interface IncomingHttpHeaders {
    [key: string]: string | string[] | undefined;
  }

  interface IncomingMessage {
    headers: IncomingHttpHeaders;
    method?: string;
    url?: string | undefined;
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

  export { createHmac, timingSafeEqual };
}

declare module 'fs/promises' {
  function readFile(path: string, encoding: string): Promise<string>;
  export { readFile };
}

declare module 'path' {
  function resolve(...parts: string[]): string;
  export { resolve };
}

declare const Buffer: {
  from(data: string, encoding?: string): Buffer;
  byteLength(data: string): number;
};

declare interface Buffer extends Uint8Array {
  toString(encoding?: string): string;
}

declare const process: {
  env: Record<string, string | undefined>;
  cwd(): string;
};
