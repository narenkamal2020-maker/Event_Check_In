import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import * as adminController from '../controllers/adminController.js';

const router = Router();

// GET /api/admin/users
router.get('/users', requireAuth, requireRole('ADMIN'), adminController.listUsers);

// PATCH /api/admin/users/:userId/role
router.patch('/users/:userId/role', requireAuth, requireRole('ADMIN'), adminController.updateUserRole);

// DELETE /api/admin/users/:userId
router.delete('/users/:userId', requireAuth, requireRole('ADMIN'), adminController.deleteUser);

export default router;
