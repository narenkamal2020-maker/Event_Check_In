import { Response } from 'express';
import { z } from 'zod';
import * as registrationService from '../services/registrationService.js';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { logAuditAction } from '../services/auditService.js';

export async function registerForEvent(req: AuthenticatedRequest, res: Response) {
  try {
    const eventId = parseInt(req.params.eventId || req.body.eventId, 10);
    if (isNaN(eventId)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid event ID' } });
    }

    const attendeeId = req.user!.userId;
    const registration = await registrationService.registerForEvent(attendeeId, eventId);

    await logAuditAction({
      userId: attendeeId,
      eventId,
      action: 'REGISTRATION_CREATED',
      metadata: { registrationNumber: registration.registrationNumber, status: registration.status },
      req,
    });

    return res.status(201).json({
      success: true,
      registration,
    });
  } catch (error: any) {
    console.error('Error registering for event:', error);
    return res.status(400).json({
      success: false,
      error: { code: 'REGISTRATION_FAILED', message: error.message || 'Failed to register' }
    });
  }
}

export async function getEventRegistrations(req: AuthenticatedRequest, res: Response) {
  try {
    const eventId = parseInt(req.params.eventId, 10);
    if (isNaN(eventId)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid event ID' } });
    }
    const status = req.query.status as string | undefined;

    const registrations = await registrationService.getRegistrations(eventId, status);
    return res.json({
      success: true,
      registrations,
    });
  } catch (error: any) {
    console.error('Error fetching registrations:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch registrations' }
    });
  }
}

export async function getMyRegistrations(req: AuthenticatedRequest, res: Response) {
  try {
    const attendeeId = req.user!.userId;
    const registrations = await registrationService.getUserRegistrations(attendeeId);
    return res.json({
      success: true,
      registrations,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch your registrations' }
    });
  }
}

export async function getRegistrationById(req: AuthenticatedRequest, res: Response) {
  try {
    const registrationId = parseInt(req.params.registrationId, 10);
    if (isNaN(registrationId)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid registration ID' } });
    }
    const reg = await registrationService.getRegistrationDetails(registrationId);

    if (!reg) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Registration not found' } });
    }

    // Check authorization: must be attendee, organizer, staff, or admin
    if (
      req.user!.role === 'ATTENDEE' &&
      reg.attendee_id !== req.user!.userId
    ) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    return res.json({
      success: true,
      registration: reg,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch registration' }
    });
  }
}

export async function cancelRegistration(req: AuthenticatedRequest, res: Response) {
  try {
    const registrationId = parseInt(req.params.registrationId, 10);
    if (isNaN(registrationId)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid registration ID' } });
    }
    const userId = req.user!.userId;
    const isAdminOrOrg = ['ADMIN', 'ORGANIZER'].includes(req.user!.role);

    const result = await registrationService.cancelRegistration(registrationId, userId, isAdminOrOrg);

    await logAuditAction({
      userId,
      action: 'REGISTRATION_CANCELLED',
      metadata: { registrationId, promotedAttendee: result.promotedAttendee },
      req,
    });

    return res.json({
      success: true,
      message: 'Registration cancelled successfully',
      result,
    });
  } catch (error: any) {
    console.error('Error cancelling registration:', error);
    return res.status(400).json({
      success: false,
      error: { code: 'CANCELLATION_FAILED', message: error.message || 'Failed to cancel registration' }
    });
  }
}
