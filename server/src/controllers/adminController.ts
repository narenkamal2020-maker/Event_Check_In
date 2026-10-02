import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { getDb } from '../../../src/db/index.js';
import { logAuditAction } from '../services/auditService.js';

export async function listUsers(req: AuthenticatedRequest, res: Response) {
  try {
    const db = await getDb();
    const result = await db.query(
      `SELECT id, name, email, role, created_at as "createdAt", updated_at as "updatedAt",
              (SELECT COUNT(*) FROM registrations WHERE attendee_id = users.id)::int as registration_count,
              (SELECT COUNT(*) FROM events WHERE organizer_id = users.id)::int as organized_events_count
       FROM users ORDER BY created_at DESC`
    );
    return res.json({ success: true, users: result.rows });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
}

export async function updateUserRole(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid user ID' } });
    }

    // Prevent admin from changing their own role (self-demotion)
    if (req.user?.userId === userId) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You cannot change your own role' } });
    }

    const { role } = req.body;
    const validRoles = ['ADMIN', 'ORGANIZER', 'STAFF', 'ATTENDEE'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_ROLE', message: 'Invalid role' } });
    }

    const db = await getDb();
    const updateRes = await db.query(
      `UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, email, role`,
      [role, userId]
    );

    if (updateRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    }

    await logAuditAction({
      userId: req.user?.userId,
      action: 'USER_ROLE_UPDATED',
      metadata: { targetUserId: userId, newRole: role },
      req,
    });

    return res.json({ success: true, message: `Role updated to ${role}`, user: updateRes.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to update role' } });
  }
}

export async function deleteUser(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid user ID' } });
    }

    // Prevent admin from deleting themselves
    if (req.user?.userId === userId) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You cannot delete your own account' } });
    }

    const db = await getDb();
    const userRes = await db.query('SELECT id, name, role FROM users WHERE id = $1', [userId]);
    if (userRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    }
    if (userRes.rows[0].role === 'ADMIN') {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Cannot delete another admin user' } });
    }

    await db.query('DELETE FROM users WHERE id = $1', [userId]);

    await logAuditAction({
      userId: req.user?.userId,
      action: 'USER_DELETED',
      metadata: { deletedUserId: userId, deletedUserName: userRes.rows[0].name },
      req,
    });

    return res.json({ success: true, message: 'User deleted successfully' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to delete user' } });
  }
}
