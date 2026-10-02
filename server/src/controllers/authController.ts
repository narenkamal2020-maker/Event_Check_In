import { Request, Response } from 'express';
import { z } from 'zod';
import { getDb } from '../../../src/db/index.js';
import { hashPassword, comparePassword, generateToken, AUTH_COOKIE_NAME, cookieOptions } from '../security/auth.js';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { logAuditAction } from '../services/auditService.js';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name too long'),
  email: z.string().email('Invalid email address').max(255, 'Email too long'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128, 'Password too long'),
  // Role is intentionally NOT accepted from public signup — always defaults to ATTENDEE
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export async function registerUser(req: Request, res: Response) {
  try {
    const data = registerSchema.parse(req.body);
    const db = await getDb();

    // Check if user already exists
    const existing = await db.query(`SELECT id FROM users WHERE email = $1`, [data.email.toLowerCase().trim()]);
    if (existing.rowCount > 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'EMAIL_EXISTS',
          message: 'An account with this email already exists.',
        }
      });
    }

    const passwordHash = await hashPassword(data.password);
    // Role is always ATTENDEE for self-registration; admins assign roles via the admin panel
    const role = 'ATTENDEE';

    const insertRes = await db.query<{ id: number; name: string; email: string; role: any; createdAt: Date }>(
      `INSERT INTO users (name, email, password_hash, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id, name, email, role, created_at as "createdAt"`,
      [data.name.trim(), data.email.toLowerCase().trim(), passwordHash, role]
    );

    const user = insertRes.rows[0];
    const token = generateToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    res.cookie(AUTH_COOKIE_NAME, token, cookieOptions);

    await logAuditAction({
      userId: user.id,
      action: 'USER_REGISTER',
      metadata: { role: user.role, email: user.email },
      req,
    });

    return res.status(201).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
      token,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: err.issues[0]?.message || 'Invalid input data',
          details: err.issues,
        }
      });
    }
    console.error('Registration error:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to create account' }
    });
  }
}

export async function loginUser(req: Request, res: Response) {
  try {
    const data = loginSchema.parse(req.body);
    const db = await getDb();

    const userRes = await db.query(
      `SELECT id, name, email, password_hash, role, created_at as "createdAt" FROM users WHERE email = $1`,
      [data.email.toLowerCase().trim()]
    );

    if (userRes.rowCount === 0) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        }
      });
    }

    const user = userRes.rows[0];
    const isMatch = await comparePassword(data.password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        }
      });
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    res.cookie(AUTH_COOKIE_NAME, token, cookieOptions);

    await logAuditAction({
      userId: user.id,
      action: 'USER_LOGIN',
      metadata: { role: user.role },
      req,
    });

    return res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
      token,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: err.issues[0]?.message || 'Invalid input data',
        }
      });
    }
    console.error('Login error:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to log in' }
    });
  }
}

export async function logoutUser(req: Request, res: Response) {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
  return res.json({ success: true, message: 'Logged out successfully' });
}

export async function getMe(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
  }

  const db = await getDb();
  const userRes = await db.query(
    `SELECT id, name, email, role, created_at as "createdAt" FROM users WHERE id = $1`,
    [req.user.userId]
  );

  if (userRes.rowCount === 0) {
    return res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
  }

  return res.json({
    success: true,
    user: userRes.rows[0],
  });
}

