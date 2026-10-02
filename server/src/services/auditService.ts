import { getDb } from '../../../src/db/index.js';
import { Request } from 'express';

export interface AuditLogParams {
  userId?: number | null;
  eventId?: number | null;
  action: string;
  metadata?: Record<string, any> | string;
  req?: Request;
}

export async function logAuditAction(params: AuditLogParams) {
  try {
    const db = await getDb();
    let ipAddress: string | null = null;
    let userAgent: string | null = null;

    if (params.req) {
      ipAddress = (params.req.headers['x-forwarded-for'] as string) || params.req.socket?.remoteAddress || null;
      userAgent = params.req.headers['user-agent'] || null;
    }

    const metaStr = typeof params.metadata === 'object' ? JSON.stringify(params.metadata) : params.metadata || null;

    await db.query(
      `INSERT INTO audit_logs (user_id, event_id, action, metadata, ip_address, user_agent, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [params.userId || null, params.eventId || null, params.action, metaStr, ipAddress, userAgent]
    );
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
