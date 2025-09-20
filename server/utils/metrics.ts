interface RouteMetric {
  count: number;
  totalDurationMs: number;
  statuses: Map<number, number>;
}

const requestMetrics = new Map<string, RouteMetric>();
const licenseDownloads = new Map<string, number>();
let totalRequests = 0;
let rateLimitBlocks = 0;

export function recordRequest(
  method: string,
  route: string,
  statusCode: number,
  durationMs: number
): void {
  totalRequests += 1;
  const key = `${method.toUpperCase()} ${route}`;
  const metric = requestMetrics.get(key) ?? { count: 0, totalDurationMs: 0, statuses: new Map<number, number>() };
  metric.count += 1;
  metric.totalDurationMs += durationMs;
  metric.statuses.set(statusCode, (metric.statuses.get(statusCode) ?? 0) + 1);
  requestMetrics.set(key, metric);
}

export function recordRateLimit(): void {
  rateLimitBlocks += 1;
}

export function recordLicenseDownload(licenseId: string): void {
  const key = licenseId.trim();
  if (!key) {
    return;
  }
  licenseDownloads.set(key, (licenseDownloads.get(key) ?? 0) + 1);
}

export interface MetricsSnapshot {
  totalRequests: number;
  rateLimitBlocks: number;
  routes: Array<{
    key: string;
    count: number;
    avgDurationMs: number;
    statuses: Record<number, number>;
  }>;
  licenseDownloads: Record<string, number>;
}

export function getMetricsSnapshot(): MetricsSnapshot {
  const routes: MetricsSnapshot['routes'] = [];
  for (const [key, metric] of requestMetrics) {
    const statuses: Record<number, number> = {};
    for (const [status, count] of metric.statuses) {
      statuses[status] = count;
    }
    routes.push({
      key,
      count: metric.count,
      avgDurationMs: metric.count > 0 ? metric.totalDurationMs / metric.count : 0,
      statuses
    });
  }

  const downloadEntries: Record<string, number> = {};
  for (const [licenseId, count] of licenseDownloads) {
    downloadEntries[licenseId] = count;
  }

  return {
    totalRequests,
    rateLimitBlocks,
    routes,
    licenseDownloads: downloadEntries
  };
}

export function renderPrometheusMetrics(): string {
  const snapshot = getMetricsSnapshot();
  const lines: string[] = [];
  lines.push('# HELP iqn_requests_total Total HTTP requests handled by the IQN API');
  lines.push('# TYPE iqn_requests_total counter');
  lines.push(`iqn_requests_total ${snapshot.totalRequests}`);
  lines.push('# HELP iqn_rate_limit_blocks_total Requests blocked by the rate limiter');
  lines.push('# TYPE iqn_rate_limit_blocks_total counter');
  lines.push(`iqn_rate_limit_blocks_total ${snapshot.rateLimitBlocks}`);
  lines.push('# HELP iqn_request_duration_ms Average request duration in milliseconds');
  lines.push('# TYPE iqn_request_duration_ms gauge');
  for (const route of snapshot.routes) {
    const label = route.key.replace(/"/g, '\\"');
    lines.push(`iqn_request_duration_ms{route="${label}"} ${route.avgDurationMs.toFixed(2)}`);
    for (const [status, count] of Object.entries(route.statuses)) {
      lines.push(`iqn_requests_by_status_total{route="${label}",status="${status}"} ${count}`);
    }
  }
  lines.push('# HELP iqn_license_downloads_total License specific exam downloads');
  lines.push('# TYPE iqn_license_downloads_total counter');
  for (const [licenseId, count] of Object.entries(snapshot.licenseDownloads)) {
    const label = licenseId.replace(/"/g, '\\"');
    lines.push(`iqn_license_downloads_total{license="${label}"} ${count}`);
  }
  return `${lines.join('\n')}\n`;
}
