import { Router } from 'express';
import * as eventController from '../controllers/eventController.js';
import * as registrationController from '../controllers/registrationController.js';
import * as checkInController from '../controllers/checkInController.js';
import * as analyticsController from '../controllers/analyticsController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { aiLimiter, apiLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Event CRUD
router.get('/', eventController.getEvents);
router.post('/', requireAuth, requireRole('ORGANIZER', 'ADMIN'), eventController.createEvent);
router.get('/:eventId', eventController.getEventById);
router.patch('/:eventId', requireAuth, requireRole('ORGANIZER', 'ADMIN'), eventController.updateEvent);
router.get('/:eventId/stations', eventController.getEventStations);

// Registration on Event
router.post('/:eventId/register', requireAuth, registrationController.registerForEvent);
router.get('/:eventId/registrations', requireAuth, requireRole('ORGANIZER', 'ADMIN', 'STAFF'), registrationController.getEventRegistrations);

// Check-ins & Scanner
router.post('/:eventId/check-in', requireAuth, requireRole('ORGANIZER', 'ADMIN', 'STAFF'), checkInController.checkIn);
router.get('/:eventId/check-ins', requireAuth, requireRole('ORGANIZER', 'ADMIN', 'STAFF'), checkInController.getEventCheckIns);
router.post('/:eventId/check-ins/sync', requireAuth, requireRole('ORGANIZER', 'ADMIN', 'STAFF'), checkInController.syncOfflineScans);

// Analytics & Insights
router.get('/:eventId/stats', requireAuth, requireRole('ORGANIZER', 'ADMIN', 'STAFF'), analyticsController.getStats);
router.post('/:eventId/insights', requireAuth, requireRole('ORGANIZER', 'ADMIN'), aiLimiter, analyticsController.askGeminiInsights);
router.get('/:eventId/export', requireAuth, requireRole('ORGANIZER', 'ADMIN'), analyticsController.exportCSV);
router.get('/:eventId/suspicious-activity', requireAuth, requireRole('ORGANIZER', 'ADMIN'), analyticsController.getSuspiciousActivity);

export default router;
