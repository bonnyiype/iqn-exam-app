import fs from 'fs';
import path from 'path';

export interface UserRecord {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
  updatedAt: string;
}

export type LicenseStatus = 'active' | 'trial' | 'revoked' | 'expired';

export interface LicenseRecord {
  id: string;
  userId: string;
  status: LicenseStatus;
  seatsTotal: number;
  seatsInUse: number;
  tier?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  renewalReminderAt?: string;
  revokedAt?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface LicenseSeatRecord {
  licenseId: string;
  seatId: string;
  assignedTo?: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface UsageRecord {
  id: string;
  licenseId: string;
  event: string;
  createdAt: string;
  seatId?: string;
  details?: Record<string, unknown>;
}

export interface DatabaseSchema {
  users: UserRecord[];
  licenses: LicenseRecord[];
  seats: LicenseSeatRecord[];
  usage: UsageRecord[];
}

const DEFAULT_DATA: DatabaseSchema = {
  users: [],
  licenses: [],
  seats: [],
  usage: []
};

let dataCache: DatabaseSchema | undefined;
let dbPath: string | undefined;

function resolveDatabasePath(): string {
  if (dbPath) {
    return dbPath;
  }

  const configured = process.env.LICENSE_DB_PATH ? process.env.LICENSE_DB_PATH.trim() : '';
  const targetPath = configured || path.join(process.cwd(), 'data', 'license-db.json');
  const directory = path.dirname(targetPath);
  fs.mkdirSync(directory, { recursive: true });
  dbPath = targetPath;
  return targetPath;
}

export function initDatabase(): DatabaseSchema {
  const filePath = resolveDatabasePath();
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(DEFAULT_DATA, null, 2), 'utf8');
    dataCache = JSON.parse(JSON.stringify(DEFAULT_DATA)) as DatabaseSchema;
    return dataCache;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  try {
    const parsed = JSON.parse(raw) as DatabaseSchema;
    dataCache = {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      licenses: Array.isArray(parsed.licenses) ? parsed.licenses : [],
      seats: Array.isArray(parsed.seats) ? parsed.seats : [],
      usage: Array.isArray(parsed.usage) ? parsed.usage : []
    };
  } catch (error) {
    fs.writeFileSync(filePath, JSON.stringify(DEFAULT_DATA, null, 2), 'utf8');
    dataCache = JSON.parse(JSON.stringify(DEFAULT_DATA)) as DatabaseSchema;
  }

  return dataCache;
}

export function getDatabase(): DatabaseSchema {
  if (!dataCache) {
    return initDatabase();
  }
  return dataCache;
}

export function saveDatabase(): void {
  if (!dataCache) {
    return;
  }
  const filePath = resolveDatabasePath();
  fs.writeFileSync(filePath, JSON.stringify(dataCache, null, 2), 'utf8');
}

export function updateDatabase<T>(mutator: (database: DatabaseSchema) => T): T {
  const database = getDatabase();
  const result = mutator(database);
  saveDatabase();
  return result;
}
