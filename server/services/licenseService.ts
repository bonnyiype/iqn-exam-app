import { HttpError } from '../middleware/licenseAuth.js';
import {
  getDatabase,
  initDatabase,
  updateDatabase
} from '../storage/database.js';
import type {
  DatabaseSchema,
  LicenseRecord,
  LicenseSeatRecord,
  LicenseStatus,
  UsageRecord,
  UserRecord
} from '../storage/database.js';
import { log } from '../utils/logger.js';

export interface LicenseSummary {
  licenseId: string;
  status: LicenseStatus;
  seatsTotal: number;
  seatsUsed: number;
  seatsRemaining: number;
  expiresAt?: string;
  renewalReminderAt?: string;
  revokedAt?: string;
  tier?: string;
  ownerName?: string;
  ownerEmail?: string;
  lastUsageAt?: string;
  totalDownloads: number;
  renewalMessage?: string;
}

export interface IssueLicenseInput {
  licenseId?: string;
  seats: number;
  status?: LicenseStatus;
  tier?: string;
  expiresAt?: string;
  renewalReminderAt?: string;
  userEmail: string;
  userName?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface RenewLicenseInput {
  expiresAt: string;
  renewalReminderAt?: string;
}

export interface LicenseUsageSummary {
  totalEvents: number;
  downloadsLast30Days: number;
  recent: UsageRecord[];
}

export function initializeLicenseStore(): void {
  initDatabase();
  seedDemoLicense();
}

export function listLicenses(): LicenseSummary[] {
  const database = getDatabase();
  return database.licenses.map((license) => buildLicenseSummary(database, license));
}

export function getLicenseSummary(licenseId: string): LicenseSummary {
  const database = getDatabase();
  const license = database.licenses.find((entry) => entry.id === licenseId);
  if (!license) {
    throw new HttpError(404, 'License not found.');
  }
  return buildLicenseSummary(database, license);
}

export function issueLicense(input: IssueLicenseInput): LicenseSummary {
  if (!input.userEmail || !input.userEmail.includes('@')) {
    throw new HttpError(400, 'A valid user email is required to issue a license.');
  }
  if (!Number.isFinite(input.seats) || input.seats <= 0) {
    throw new HttpError(400, 'Licenses must have at least one seat.');
  }

  const licenseId = (input.licenseId || generateLicenseId()).trim();
  return updateDatabase((database) => {
    const existing = database.licenses.find((item) => item.id === licenseId);
    if (existing) {
      throw new HttpError(409, 'A license with this identifier already exists.');
    }

    const user = upsertUser(database, input.userEmail, input.userName);
    const now = new Date().toISOString();
    const record: LicenseRecord = {
      id: licenseId,
      userId: user.id,
      status: input.status ?? 'active',
      seatsTotal: Math.max(1, Math.floor(input.seats)),
      seatsInUse: 0,
      tier: input.tier,
      createdAt: now,
      updatedAt: now,
      expiresAt: input.expiresAt,
      renewalReminderAt: input.renewalReminderAt,
      notes: input.notes,
      metadata: input.metadata
    };

    database.licenses.push(record);
    log('info', 'Issued new license', { licenseId: record.id, userEmail: user.email });
    return buildLicenseSummary(database, record);
  });
}

export function renewLicense(licenseId: string, input: RenewLicenseInput): LicenseSummary {
  if (!input.expiresAt) {
    throw new HttpError(400, 'The new expiration date is required.');
  }

  return updateDatabase((database) => {
    const license = database.licenses.find((entry) => entry.id === licenseId);
    if (!license) {
      throw new HttpError(404, 'License not found.');
    }

    license.expiresAt = input.expiresAt;
    license.renewalReminderAt = input.renewalReminderAt;
    license.updatedAt = new Date().toISOString();
    if (license.status === 'expired') {
      license.status = 'active';
    }

    log('info', 'Renewed license', { licenseId });
    return buildLicenseSummary(database, license);
  });
}

export function revokeLicense(licenseId: string, reason?: string): LicenseSummary {
  return updateDatabase((database) => {
    const license = database.licenses.find((entry) => entry.id === licenseId);
    if (!license) {
      throw new HttpError(404, 'License not found.');
    }

    license.status = 'revoked';
    license.revokedAt = new Date().toISOString();
    license.updatedAt = license.revokedAt;
    if (reason) {
      license.notes = reason;
    }

    log('warn', 'License revoked', { licenseId, reason });
    return buildLicenseSummary(database, license);
  });
}

export function restoreLicense(licenseId: string): LicenseSummary {
  return updateDatabase((database) => {
    const license = database.licenses.find((entry) => entry.id === licenseId);
    if (!license) {
      throw new HttpError(404, 'License not found.');
    }

    license.status = 'active';
    license.revokedAt = undefined;
    license.updatedAt = new Date().toISOString();

    log('info', 'License restored', { licenseId });
    return buildLicenseSummary(database, license);
  });
}

export function recordUsage(
  licenseId: string,
  event: string,
  details: Record<string, unknown> = {},
  seatId?: string
): void {
  const now = new Date().toISOString();
  updateDatabase((database) => {
    const license = database.licenses.find((entry) => entry.id === licenseId);
    if (!license) {
      throw new HttpError(404, 'License not found.');
    }
    const usage: UsageRecord = {
      id: createIdentifier('usage', 6),
      licenseId,
      event,
      createdAt: now,
      seatId,
      details
    };
    database.usage.push(usage);
    license.updatedAt = now;
  });
}

export function ensureSeatAssignment(
  licenseId: string,
  seatId: string,
  seatLabel?: string
): { seatsUsed: number; seatsRemaining: number } {
  const normalizedSeat = seatId.trim() || 'default-seat';
  return updateDatabase((database) => {
    const license = database.licenses.find((entry) => entry.id === licenseId);
    if (!license) {
      throw new HttpError(404, 'License not found.');
    }

    let seat = database.seats.find((entry) => entry.licenseId === licenseId && entry.seatId === normalizedSeat);
    const now = new Date().toISOString();

    if (!seat) {
      if (license.seatsInUse >= license.seatsTotal) {
        throw new HttpError(403, 'All seats for this license are already allocated.');
      }
      seat = {
        licenseId,
        seatId: normalizedSeat,
        assignedTo: seatLabel,
        firstSeenAt: now,
        lastSeenAt: now
      } satisfies LicenseSeatRecord;
      database.seats.push(seat);
      license.seatsInUse += 1;
    } else {
      seat.lastSeenAt = now;
      if (seatLabel && seatLabel !== seat.assignedTo) {
        seat.assignedTo = seatLabel;
      }
    }

    license.updatedAt = now;
    return {
      seatsUsed: license.seatsInUse,
      seatsRemaining: Math.max(0, license.seatsTotal - license.seatsInUse)
    };
  });
}

export function assertLicenseActive(licenseId: string): LicenseSummary {
  const summary = getLicenseSummary(licenseId);
  if (summary.status === 'revoked') {
    throw new HttpError(403, 'This license has been revoked.');
  }
  if (summary.status === 'expired') {
    throw new HttpError(403, 'This license is expired. Please renew to regain access.');
  }
  return summary;
}

export function getUsageSummary(licenseId: string): LicenseUsageSummary {
  const database = getDatabase();
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const relevant = database.usage.filter((entry) => entry.licenseId === licenseId);
  const downloadsLast30Days = relevant.filter((entry) => entry.event === 'questions.download' && new Date(entry.createdAt).getTime() >= thirtyDaysAgo).length;
  const recent = relevant.slice(-25).reverse();
  return {
    totalEvents: relevant.length,
    downloadsLast30Days,
    recent
  };
}

function buildLicenseSummary(database: DatabaseSchema, license: LicenseRecord): LicenseSummary {
  const user = database.users.find((entry) => entry.id === license.userId);
  const usage = database.usage.filter((entry) => entry.licenseId === license.id);
  const totalDownloads = usage.filter((entry) => entry.event === 'questions.download').length;
  const lastUsageAt = usage.length > 0 ? usage[usage.length - 1].createdAt : undefined;
  let status = license.status;

  if (license.expiresAt) {
    const expiresAtMs = new Date(license.expiresAt).getTime();
    if (Number.isFinite(expiresAtMs) && expiresAtMs < Date.now() && status !== 'revoked') {
      status = 'expired';
    }
  }

  let renewalMessage: string | undefined;
  if (status === 'expired') {
    renewalMessage = 'Your license has expired. Renew to continue receiving exam updates.';
  } else if (license.expiresAt) {
    const diff = new Date(license.expiresAt).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (Number.isFinite(days) && days <= 14) {
      renewalMessage = `License expires in ${days} day${days === 1 ? '' : 's'}.`;
    }
  }

  return {
    licenseId: license.id,
    status,
    seatsTotal: license.seatsTotal,
    seatsUsed: license.seatsInUse,
    seatsRemaining: Math.max(0, license.seatsTotal - license.seatsInUse),
    expiresAt: license.expiresAt,
    renewalReminderAt: license.renewalReminderAt,
    revokedAt: license.revokedAt,
    tier: license.tier,
    ownerName: user?.name,
    ownerEmail: user?.email,
    lastUsageAt,
    totalDownloads,
    renewalMessage
  };
}

function upsertUser(database: DatabaseSchema, email: string, name?: string): UserRecord {
  const normalizedEmail = email.trim().toLowerCase();
  let user = database.users.find((entry) => entry.email === normalizedEmail);
  const now = new Date().toISOString();

  if (!user) {
    user = {
      id: createIdentifier('user', 6),
      email: normalizedEmail,
      name: name?.trim(),
      createdAt: now,
      updatedAt: now
    } satisfies UserRecord;
    database.users.push(user);
  } else {
    if (name && name.trim() && name.trim() !== (user.name ?? '')) {
      user.name = name.trim();
      user.updatedAt = now;
    }
  }

  return user;
}

function generateLicenseId(): string {
  return createIdentifier('lic', 8);
}

function createIdentifier(prefix: string, randomLength = 8): string {
  return `${prefix}_${Date.now().toString(36)}${randomString(randomLength)}`;
}

function randomString(length: number): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let output = '';
  for (let index = 0; index < length; index += 1) {
    const randomIndex = Math.floor(Math.random() * alphabet.length);
    output += alphabet[randomIndex];
  }
  return output;
}

function seedDemoLicense(): void {
  updateDatabase((database) => {
    if (database.licenses.some((license) => license.id === 'demo-license')) {
      return;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const user = upsertUser(database, 'demo@example.com', 'Demo Account');
    const record: LicenseRecord = {
      id: 'demo-license',
      userId: user.id,
      status: 'trial',
      seatsTotal: 3,
      seatsInUse: 0,
      tier: 'trial',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt,
      renewalReminderAt: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000).toISOString(),
      notes: 'Auto-generated demo license'
    };
    database.licenses.push(record);
    log('info', 'Seeded demo license', { licenseId: record.id });
  });
}
