// Keep these values in sync with the Vite dev server configuration (see vite.config.js).
export const DEV_SERVER_HOST = 'localhost';
export const DEV_SERVER_PORT = 3000;
export const DEV_SERVER_ORIGINS = Object.freeze([
  `http://${DEV_SERVER_HOST}:${DEV_SERVER_PORT}`,
  `http://127.0.0.1:${DEV_SERVER_PORT}`,
]);
