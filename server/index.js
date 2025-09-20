import { createServer } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';

const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-me';
const COOKIE_NAME = 'iqn_session';
const TOKEN_TTL_HOURS = 4;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';

const LICENSES = [
  {
    key: 'IQN-VALID-0001',
    owner: 'Demo Candidate',
    plan: 'Pro',
    expiresAt: new Date('2026-01-01T00:00:00Z').toISOString(),
    revoked: false
  },
  {
    key: 'IQN-EXPIRED-0000',
    owner: 'Expired Candidate',
    plan: 'Standard',
    expiresAt: new Date('2024-01-01T00:00:00Z').toISOString(),
    revoked: false
  },
  {
    key: 'IQN-REVOKED-0000',
    owner: 'Revoked Candidate',
    plan: 'Starter',
    expiresAt: new Date('2026-01-01T00:00:00Z').toISOString(),
    revoked: true
  }
];

const toBase64Url = (buffer) => Buffer.from(buffer).toString('base64url');

const signJwt = (payload, secret, hours = TOKEN_TTL_HOURS) => {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + hours * 60 * 60;
  const fullPayload = { ...payload, exp };

  const headerEncoded = toBase64Url(JSON.stringify(header));
  const payloadEncoded = toBase64Url(JSON.stringify(fullPayload));
  const signature = createHmac('sha256', secret)
    .update(`${headerEncoded}.${payloadEncoded}`)
    .digest('base64url');

  return `${headerEncoded}.${payloadEncoded}.${signature}`;
};

const verifyJwt = (token, secret) => {
  if (!token) return null;
  const [headerEncoded, payloadEncoded, signature] = token.split('.');
  if (!headerEncoded || !payloadEncoded || !signature) return null;

  const expectedSignature = createHmac('sha256', secret)
    .update(`${headerEncoded}.${payloadEncoded}`)
    .digest();
  const providedSignature = Buffer.from(signature, 'base64url');

  if (expectedSignature.length !== providedSignature.length ||
      !timingSafeEqual(expectedSignature, providedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadEncoded, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch (error) {
    return null;
  }
};

const findLicense = (licenseKey = '') => {
  const normalised = licenseKey.trim().toUpperCase();
  return LICENSES.find((license) => license.key === normalised) || null;
};

const licenseToClient = (license) => ({
  owner: license.owner,
  plan: license.plan,
  expiresAt: license.expiresAt,
  licenseKeyLast4: license.key.slice(-4)
});

const validateLicense = (license) => {
  if (!license) {
    return { valid: false, reason: 'invalid' };
  }

  if (license.revoked) {
    return { valid: false, reason: 'revoked', license };
  }

  const expiresAt = new Date(license.expiresAt);
  if (Number.isNaN(expiresAt.getTime())) {
    return { valid: false, reason: 'invalid', license };
  }

  if (new Date() > expiresAt) {
    return { valid: false, reason: 'expired', license };
  }

  return { valid: true, license };
};

const parseCookies = (cookieHeader = '') => {
  return cookieHeader.split(';').reduce((acc, pair) => {
    const [key, ...rest] = pair.trim().split('=');
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
};

const readJsonBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) return {};

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    return {};
  }
};

const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Vary', 'Origin');
};

const sendJson = (res, statusCode, payload) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
};

const setSessionCookie = (res, token) => {
  const maxAge = TOKEN_TTL_HOURS * 60 * 60;
  const parts = [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'SameSite=Lax'
  ];
  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
};

const clearSessionCookie = (res) => {
  const parts = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax'
  ];
  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
};

const handleSession = (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[COOKIE_NAME];
  const decoded = verifyJwt(token, JWT_SECRET);

  if (!decoded) {
    clearSessionCookie(res);
    return sendJson(res, 401, { error: 'not_authenticated' });
  }

  const license = findLicense(decoded.licenseKey);
  const validation = validateLicense(license);

  if (!validation.valid) {
    clearSessionCookie(res);
    const { reason } = validation;
    if (reason === 'expired') {
      return sendJson(res, 403, {
        error: 'license_expired',
        message: 'Your license has expired. Please renew to continue.',
        license: license ? licenseToClient(license) : null
      });
    }

    if (reason === 'revoked') {
      return sendJson(res, 403, {
        error: 'license_revoked',
        message: 'This license has been revoked. Contact support for assistance.',
        license: license ? licenseToClient(license) : null
      });
    }

    return sendJson(res, 401, { error: 'not_authenticated' });
  }

  return sendJson(res, 200, {
    message: 'Session validated',
    license: licenseToClient(validation.license)
  });
};

const handleLogin = async (req, res) => {
  const body = await readJsonBody(req);
  const license = findLicense(body.licenseKey || '');
  const validation = validateLicense(license);

  if (!validation.valid) {
    const { reason } = validation;
    if (reason === 'expired') {
      clearSessionCookie(res);
      return sendJson(res, 403, {
        error: 'license_expired',
        message: 'Your license expired. Enter a new key to continue.',
        license: license ? licenseToClient(license) : null
      });
    }

    if (reason === 'revoked') {
      clearSessionCookie(res);
      return sendJson(res, 403, {
        error: 'license_revoked',
        message: 'This license has been revoked. Please contact support.',
        license: license ? licenseToClient(license) : null
      });
    }

    return sendJson(res, 401, {
      error: 'invalid_license',
      message: 'License key not recognised.'
    });
  }

  const token = signJwt({ licenseKey: validation.license.key }, JWT_SECRET);
  setSessionCookie(res, token);

  return sendJson(res, 200, {
    message: 'License verified successfully',
    license: licenseToClient(validation.license)
  });
};

const handleLogout = (res) => {
  clearSessionCookie(res);
  return sendJson(res, 200, { message: 'Signed out' });
};

const server = createServer(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const { pathname } = url;

  if (pathname === '/api/auth/session' && req.method === 'GET') {
    handleSession(req, res);
    return;
  }

  if (pathname === '/api/auth/login' && req.method === 'POST') {
    await handleLogin(req, res);
    return;
  }

  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    handleLogout(res);
    return;
  }

  if (pathname === '/health' && req.method === 'GET') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ error: 'not_found' }));
});

server.listen(PORT, () => {
  console.log(`Auth server listening on port ${PORT}`);
});
