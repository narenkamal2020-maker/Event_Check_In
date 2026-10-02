import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export interface DBClient {
  query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }>;
  transaction<T>(callback: (client: DBClient) => Promise<T>): Promise<T>;
}

class PgPoolClient implements DBClient {
  constructor(private pool: pg.Pool) {}

  async query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> {
    const res = await this.pool.query(sql, params);
    return { rows: res.rows as T[], rowCount: res.rowCount ?? res.rows.length };
  }

  async transaction<T>(callback: (client: DBClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const txClient: DBClient = {
        query: async <R = any>(s: string, p?: any[]) => {
          const res = await client.query(s, p);
          return { rows: res.rows as R[], rowCount: res.rowCount ?? res.rows.length };
        },
        transaction: async () => {
          throw new Error('Nested transactions not supported');
        }
      };
      const result = await callback(txClient);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

class PGliteClient implements DBClient {
  constructor(private pglite: PGlite) {}

  async query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> {
    const res = await this.pglite.query(sql, params);
    return { rows: (res.rows || []) as T[], rowCount: res.rows ? res.rows.length : 0 };
  }

  async transaction<T>(callback: (client: DBClient) => Promise<T>): Promise<T> {
    return await this.pglite.transaction(async (tx) => {
      const txClient: DBClient = {
        query: async <R = any>(s: string, p?: any[]) => {
          const res = await tx.query(s, p);
          return { rows: (res.rows || []) as R[], rowCount: res.rows ? res.rows.length : 0 };
        },
        transaction: async () => {
          throw new Error('Nested transactions not supported');
        }
      };
      return await callback(txClient);
    });
  }
}

let dbInstance: DBClient | null = null;
let pgliteInstance: PGlite | null = null;

export async function getDb(): Promise<DBClient> {
  if (dbInstance) return dbInstance;

  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl && !databaseUrl.includes('placeholder')) {
    try {
      const pool = new Pool({
        connectionString: databaseUrl,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
      // Test connection
      await pool.query('SELECT 1');
      console.log('Connected to PostgreSQL database');
      dbInstance = new PgPoolClient(pool);
      return dbInstance;
    } catch (err) {
      console.warn('Failed to connect to DATABASE_URL PostgreSQL instance. Falling back to embedded PGlite engine:', (err as Error).message);
    }
  }

  // Fallback to local PGlite (embedded PostgreSQL)
  const dataDir = path.resolve(process.cwd(), '.pgdata');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  pgliteInstance = new PGlite(dataDir);
  await pgliteInstance.waitReady;
  console.log('Embedded PostgreSQL engine (PGlite) initialized at:', dataDir);
  dbInstance = new PGliteClient(pgliteInstance);
  
  // Ensure schema is created
  await ensureSchema(dbInstance);
  return dbInstance;
}

export async function ensureSchema(db: DBClient): Promise<void> {
  const schemaSQL = `
    DO $$ BEGIN
      CREATE TYPE role AS ENUM ('ADMIN', 'ORGANIZER', 'STAFF', 'ATTENDEE');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE event_status AS ENUM ('DRAFT', 'PUBLISHED', 'ONGOING', 'COMPLETED', 'CANCELLED');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE registration_status AS ENUM ('REGISTERED', 'WAITLISTED', 'CANCELLED', 'CHECKED_IN');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE suspicious_type AS ENUM (
        'DUPLICATE_SCAN',
        'RAPID_MULTI_STATION_SCAN',
        'INVALID_TOKEN',
        'EXPIRED_TOKEN',
        'REVOKED_TOKEN',
        'OFFLINE_SYNC_CONFLICT',
        'OTHER'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE suspicious_severity AS ENUM ('LOW', 'MEDIUM', 'HIGH');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'ATTENDEE',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      organizer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      location TEXT NOT NULL,
      start_time TIMESTAMP NOT NULL,
      end_time TIMESTAMP NOT NULL,
      capacity INTEGER NOT NULL CHECK (capacity > 0),
      status TEXT NOT NULL DEFAULT 'PUBLISHED',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS stations (
      id SERIAL PRIMARY KEY,
      event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      gate_name TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS registrations (
      id SERIAL PRIMARY KEY,
      event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      attendee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      registration_number TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'REGISTERED',
      waitlist_position INTEGER,
      registered_at TIMESTAMP DEFAULT NOW(),
      cancelled_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      CONSTRAINT unique_event_attendee UNIQUE(event_id, attendee_id)
    );

    CREATE TABLE IF NOT EXISTS qr_tokens (
      id SERIAL PRIMARY KEY,
      registration_id INTEGER NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP,
      revoked_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS check_ins (
      id SERIAL PRIMARY KEY,
      registration_id INTEGER NOT NULL UNIQUE REFERENCES registrations(id) ON DELETE CASCADE,
      event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      station_id INTEGER NOT NULL REFERENCES stations(id),
      token_id INTEGER NOT NULL REFERENCES qr_tokens(id),
      device_id TEXT,
      checked_in_at TIMESTAMP NOT NULL DEFAULT NOW(),
      sync_source TEXT NOT NULL DEFAULT 'ONLINE',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS offline_scans (
      id SERIAL PRIMARY KEY,
      client_scan_id TEXT NOT NULL UNIQUE,
      event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      registration_token TEXT NOT NULL,
      station_id INTEGER NOT NULL REFERENCES stations(id),
      device_id TEXT,
      scanned_at_client TIMESTAMP NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'PENDING',
      synced_at TIMESTAMP,
      conflict_reason TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS suspicious_activity (
      id SERIAL PRIMARY KEY,
      event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      registration_id INTEGER REFERENCES registrations(id) ON DELETE SET NULL,
      station_id INTEGER REFERENCES stations(id) ON DELETE SET NULL,
      type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'MEDIUM',
      description TEXT NOT NULL,
      metadata TEXT,
      is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
      resolution TEXT,
      detected_at TIMESTAMP NOT NULL DEFAULT NOW(),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      metadata TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_reg_event ON registrations(event_id);
    CREATE INDEX IF NOT EXISTS idx_checkins_event ON check_ins(event_id);
    CREATE INDEX IF NOT EXISTS idx_tokens_reg ON qr_tokens(registration_id);
    CREATE INDEX IF NOT EXISTS idx_suspicious_event ON suspicious_activity(event_id);
  `;

  // Execute statements
  const statements = schemaSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const statement of statements) {
    try {
      await db.query(statement);
    } catch (err: any) {
      // Silently continue — table/type may already exist
    }
  }

  // ── Safe ALTER TABLE migrations for existing databases ──────────────────────
  const migrations = [
    `ALTER TABLE registrations ADD COLUMN IF NOT EXISTS waitlist_position INTEGER`,
    `ALTER TABLE suspicious_activity ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN NOT NULL DEFAULT FALSE`,
    `ALTER TABLE suspicious_activity ADD COLUMN IF NOT EXISTS resolution TEXT`,
    `ALTER TABLE suspicious_activity ADD COLUMN IF NOT EXISTS detected_at TIMESTAMP NOT NULL DEFAULT NOW()`,
  ];

  for (const migration of migrations) {
    try {
      await db.query(migration);
    } catch (_) {
      // Column may already exist — safe to ignore
    }
  }
}

