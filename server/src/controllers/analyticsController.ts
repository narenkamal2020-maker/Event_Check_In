import { Response } from 'express';
import { z } from 'zod';
import * as analyticsService from '../services/analyticsService.js';
import * as geminiService from '../services/geminiService.js';
import * as exportService from '../services/exportService.js';
import * as suspiciousService from '../services/suspiciousService.js';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { logAuditAction } from '../services/auditService.js';

const insightQuestionSchema = z.object({
  question: z.string().min(1, 'Question cannot be empty').max(300, 'Question too long (max 300 chars)'),
});

export async function getStats(req: AuthenticatedRequest, res: Response) {
  try {
    const eventId = parseInt(req.params.eventId, 10);
    if (isNaN(eventId)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid event ID' } });
    }
    const stats = await analyticsService.getEventStats(eventId);
    // Spread stats into response root so frontend can destructure directly
    return res.json({ success: true, ...stats });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message || 'Failed to fetch analytics' }
    });
  }
}

export async function askGeminiInsights(req: AuthenticatedRequest, res: Response) {
  try {
    const eventId = parseInt(req.params.eventId, 10);
    if (isNaN(eventId)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid event ID' } });
    }
    const { question } = insightQuestionSchema.parse(req.body);

    const insight = await geminiService.generateEventInsight(eventId, question);

    await logAuditAction({
      userId: req.user?.userId,
      eventId,
      action: 'AI_INSIGHT_QUERIED',
      metadata: { question, source: insight.source },
      req,
    });

    return res.json({
      success: true,
      answer: insight.answer,
      verifiedStats: insight.verifiedStats,
      source: insight.source,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.issues[0]?.message || 'Invalid question',
        }
      });
    }
    console.error('Error generating AI insight:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'AI_INSIGHT_FAILED', message: error.message || 'Failed to generate AI insight' }
    });
  }
}

export async function exportCSV(req: AuthenticatedRequest, res: Response) {
  try {
    const eventId = parseInt(req.params.eventId, 10);
    if (isNaN(eventId)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid event ID' } });
    }
    const filter = (req.query.filter as string) || (req.query.status as string) || 'all';

    const csvContent = await exportService.generateAttendanceCSV(eventId, filter);

    await logAuditAction({
      userId: req.user?.userId,
      eventId,
      action: 'EXPORT_GENERATED',
      metadata: { filter },
      req,
    });

    const filename = `eventra-event-${eventId}-attendance-${filter}-${Date.now()}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  } catch (error: any) {
    console.error('Error exporting CSV:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'EXPORT_FAILED', message: error.message || 'Failed to export CSV' }
    });
  }
}

export async function getSuspiciousActivity(req: AuthenticatedRequest, res: Response) {
  try {
    const eventId = parseInt(req.params.eventId, 10);
    if (isNaN(eventId)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid event ID' } });
    }
    const incidents = await suspiciousService.getSuspiciousActivity(eventId);
    // Normalize: add is_resolved boolean and detected_at alias
    const normalized = incidents.map((inc: any) => ({
      ...inc,
      is_resolved: !!inc.resolved_at,
      detected_at: inc.created_at,
    }));
    return res.json({ success: true, incidents: normalized });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch suspicious activity' }
    });
  }
}

export async function resolveSuspiciousActivity(req: AuthenticatedRequest, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid incident ID' } });
    }
    const resolution = req.body.resolution || 'Resolved by organizer';
    const resolved = await suspiciousService.resolveSuspiciousActivity(id, resolution);

    await logAuditAction({
      userId: req.user?.userId,
      action: 'SUSPICIOUS_ACTIVITY_RESOLVED',
      metadata: { incidentId: id, resolution },
      req,
    });

    return res.json({
      success: true,
      resolved,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: { code: 'RESOLVE_FAILED', message: error.message || 'Failed to resolve incident' }
    });
  }
}
