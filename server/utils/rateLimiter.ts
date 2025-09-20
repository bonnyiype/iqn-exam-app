interface RateLimitConfig {
  windowMs: number;
  limit: number;
}

interface RateLimitState {
  expiresAt: number;
  count: number;
}

const globalState = new Map<string, RateLimitState>();

export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): boolean {
  const now = Date.now();
  const state = globalState.get(key);

  if (!state || state.expiresAt <= now) {
    globalState.set(key, {
      expiresAt: now + config.windowMs,
      count: 1
    });
    return true;
  }

  if (state.count >= config.limit) {
    return false;
  }

  state.count += 1;
  return true;
}

export function getRateLimitReset(key: string, defaultWindow: number): number {
  const state = globalState.get(key);
  if (!state) {
    return Date.now() + defaultWindow;
  }
  return state.expiresAt;
}
