import { Router } from 'express';
import * as registrationController from '../controllers/registrationController.js';
import * as qrController from '../controllers/qrController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

// GET /api/registrations/my
router.get('/my', requireAuth, registrationController.getMyRegistrations);

// POST /api/registrations/:eventId/register — frontend eventsApi.register calls this
router.post('/:eventId/register', requireAuth, registrationController.registerForEvent);

// GET /api/registrations/event/:eventId — event registrations list
router.get('/event/:eventId', requireAuth, registrationController.getEventRegistrations);

// GET /api/registrations/:registrationId/pass — digital pass with QR
router.get('/:registrationId/pass', requireAuth, qrController.getActivePass);

// POST /api/registrations/:registrationId/cancel
router.post('/:registrationId/cancel', requireAuth, registrationController.cancelRegistration);

// GET /api/registrations/:registrationId
router.get('/:registrationId', requireAuth, registrationController.getRegistrationById);

// POST /api/registrations/:registrationId/qr/refresh
router.post('/:registrationId/qr/refresh', requireAuth, qrController.refreshQRToken);

export default router;
