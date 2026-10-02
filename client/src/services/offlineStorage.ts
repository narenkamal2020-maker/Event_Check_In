import { openDB, type IDBPDatabase } from 'idb';
import type { OfflineScanItem } from './api';

const DB_NAME = 'eventra-checkin-offline';
const DB_VERSION = 1;
const STORE_SCANS = 'pending_scans';

export interface PendingScan extends OfflineScanItem {
  status: 'PENDING' | 'SYNCED' | 'CONFLICT';
  addedAt: string;
}

let _db: IDBPDatabase | null = null;

async function getDB(): Promise<IDBPDatabase> {
  if (_db) return _db;
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_SCANS)) {
        const store = db.createObjectStore(STORE_SCANS, { keyPath: 'clientScanId' });
        store.createIndex('status', 'status');
        store.createIndex('addedAt', 'addedAt');
      }
    },
  });
  return _db;
}

export const offlineStorage = {
  async addScan(scan: OfflineScanItem): Promise<void> {
    const db = await getDB();
    const pending: PendingScan = {
      ...scan,
      status: 'PENDING',
      addedAt: new Date().toISOString(),
    };
    await db.put(STORE_SCANS, pending);
  },

  async getPendingScans(): Promise<PendingScan[]> {
    const db = await getDB();
    return db.getAllFromIndex(STORE_SCANS, 'status', 'PENDING');
  },

  async getAllScans(): Promise<PendingScan[]> {
    const db = await getDB();
    return db.getAll(STORE_SCANS);
  },

  async getPendingCount(): Promise<number> {
    const db = await getDB();
    const pending = await db.getAllFromIndex(STORE_SCANS, 'status', 'PENDING');
    return pending.length;
  },

  async markSynced(clientScanId: string): Promise<void> {
    const db = await getDB();
    const scan = await db.get(STORE_SCANS, clientScanId);
    if (scan) {
      scan.status = 'SYNCED';
      await db.put(STORE_SCANS, scan);
    }
  },

  async markConflict(clientScanId: string): Promise<void> {
    const db = await getDB();
    const scan = await db.get(STORE_SCANS, clientScanId);
    if (scan) {
      scan.status = 'CONFLICT';
      await db.put(STORE_SCANS, scan);
    }
  },

  async clearSynced(): Promise<void> {
    const db = await getDB();
    const all = await db.getAll(STORE_SCANS);
    for (const scan of all) {
      if (scan.status === 'SYNCED') {
        await db.delete(STORE_SCANS, scan.clientScanId);
      }
    }
  },
};
