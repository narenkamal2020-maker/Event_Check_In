import { Response } from 'express';
import { z } from 'zod';
import * as eventService from '../services/eventService.js';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { logAuditAction } from '../services/auditService.js';

const createEventSchema = z.object({
  name: z.string().min(3, 'Event name must be at least 3 characters'),
  description: z.string().optional(),
  location: z.string().min(2, 'Location is required'),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
  capacity: z.number().int().positive('Capacity must be a positive number'),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ONGOING', 'COMPLETED', 'CANCELLED']).optional(),
  stations: z.array(z.object({
    name: z.string().min(1),
    gateName: z.string().min(1),
  })).optional(),
});

export async function createEvent(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedData = createEventSchema.parse(req.body);
    const organizerId = req.user!.userId;

    const event = await eventService.createEvent({
      ...validatedData,
      organizerId,
    });

    await logAuditAction({
      userId: organizerId,
      eventId: event.id,
      action: 'EVENT_CREATED',
      metadata: { name: event.name, capacity: event.capacity },
      req,
    });

    return res.status(201).json({
      success: true,
      event,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.issues[0]?.message || 'Invalid event data',
          details: error.issues,
        }
      });
    }
    console.error('Error creating event:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message || 'Failed to create event' }
    });
  }
}

export async function getEvents(req: AuthenticatedRequest, res: Response) {
  try {
    const isOrganizerMode = req.query.mode === 'organizer';
    const filter: any = {};

    if (isOrganizerMode && req.user && ['ORGANIZER', 'ADMIN'].includes(req.user.role)) {
      if (req.user.role === 'ORGANIZER') {
        filter.organizerId = req.user.userId;
      }
    } else {
      filter.publishedOnly = true;
    }

    const events = await eventService.getEvents(filter);
    return res.json({
      success: true,
      events,
    });
  } catch (error: any) {
    console.error('Error fetching events:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch events' }
    });
  }
}

export async function getEventById(req: AuthenticatedRequest, res: Response) {
  try {
    const eventId = parseInt(req.params.eventId, 10);
    if (isNaN(eventId)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid event ID' } });
    }

    const event = await eventService.getEventById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Event not found' } });
    }

    return res.json({
      success: true,
      event,
    });
  } catch (error: any) {
    console.error('Error fetching event details:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch event' }
    });
  }
}

export async function updateEvent(req: AuthenticatedRequest, res: Response) {
  try {
    const eventId = parseInt(req.params.eventId, 10);
    if (isNaN(eventId)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid event ID' } });
    }
    const organizerId = req.user!.userId;
    const isAdmin = req.user!.role === 'ADMIN';

    const event = await eventService.updateEvent(eventId, organizerId, req.body, isAdmin);

    await logAuditAction({
      userId: organizerId,
      eventId,
      action: 'EVENT_UPDATED',
      metadata: req.body,
      req,
    });

    return res.json({
      success: true,
      event,
    });
  } catch (error: any) {
    console.error('Error updating event:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message || 'Failed to update event' }
    });
  }
}

export async function getEventStations(req: AuthenticatedRequest, res: Response) {
  try {
    const eventId = parseInt(req.params.eventId, 10);
    if (isNaN(eventId)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid event ID' } });
    }
    const stations = await eventService.getEventStations(eventId);
    return res.json({
      success: true,
      stations,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch stations' }
    });
  }
}
