import { ShieldCheck, AlertTriangle, Clock } from 'lucide-react';
import { useLicenseStore } from '../store/useLicenseStore';
import { Badge } from './ui';

function formatDate(value?: string): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

const STATUS_STYLES: Record<string, { label: string; badge: 'success' | 'warning' | 'error' | 'secondary' | 'info' }> = {
  active: { label: 'Active', badge: 'success' },
  trial: { label: 'Trial', badge: 'info' },
  revoked: { label: 'Revoked', badge: 'error' },
  expired: { label: 'Expired', badge: 'warning' },
  unknown: { label: 'Unknown', badge: 'warning' }
};

export function LicenseStatusBanner() {
  const { info, status, message, lastUpdatedAt } = useLicenseStore((state) => ({
    info: state.info,
    status: state.status,
    message: state.message,
    lastUpdatedAt: state.lastUpdatedAt
  }));

  const styles = STATUS_STYLES[status] ?? STATUS_STYLES.unknown;
  const seatsRemaining = info ? Math.max(0, info.seatsRemaining ?? 0) : null;
  const seatSummary = info ? `${info.seatsUsed ?? 0}/${info.seatsTotal ?? 0} seats in use` : 'No active license';
  const expiresDisplay = info ? formatDate(info.expiresAt) : null;
  const lastSynced = formatDate(lastUpdatedAt ?? undefined);

  return (
    <div className="w-full rounded-2xl border border-indigo-100 dark:border-indigo-900/40 bg-white/70 dark:bg-gray-900/40 backdrop-blur px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-start gap-3">
        {status === 'active' || status === 'trial' ? (
          <ShieldCheck className="text-emerald-500" size={22} aria-hidden="true" />
        ) : (
          <AlertTriangle className="text-amber-500" size={22} aria-hidden="true" />
        )}
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={styles.badge}>{styles.label}</Badge>
            {info?.tier && (
              <Badge variant="secondary">Tier: {info.tier}</Badge>
            )}
            {info ? (
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {seatSummary} • {seatsRemaining ?? 0} seats remaining
              </span>
            ) : (
              <span className="text-sm text-gray-600 dark:text-gray-400">Connect a valid license to download the question bank.</span>
            )}
          </div>
          {expiresDisplay && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Expires {expiresDisplay}</p>
          )}
          {message && (
            <p className="text-sm text-amber-600 dark:text-amber-300 mt-1">{message}</p>
          )}
        </div>
      </div>
      {lastSynced && (
        <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 gap-1">
          <Clock size={14} aria-hidden="true" />
          <span>Updated {lastSynced}</span>
        </div>
      )}
    </div>
  );
}
