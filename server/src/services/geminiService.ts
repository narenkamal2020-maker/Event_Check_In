import { GoogleGenAI } from '@google/genai';
import { getEventStats, EventAnalytics } from './analyticsService.js';

export interface AIInsightResponse {
  answer: string;
  source: 'GEMINI_AI' | 'FALLBACK_VERIFIED_STATS';
  verifiedStats: EventAnalytics;
}

export async function generateEventInsight(
  eventId: number,
  question: string
): Promise<AIInsightResponse> {
  // 1. Fetch real PostgreSQL ground truth data first
  const stats = await getEventStats(eventId);

  // Sanitization and prompt guard
  const sanitizedQuestion = question.trim().substring(0, 300);
  if (!sanitizedQuestion) {
    throw new Error('Question cannot be empty');
  }

  const apiKey = process.env.GEMINI_API_KEY;

  // 2. Check if API key is provided and not a placeholder
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.includes('placeholder')) {
    return {
      answer: formatDeterministicFallback(sanitizedQuestion, stats, 'Gemini API key is not configured.'),
      source: 'FALLBACK_VERIFIED_STATS',
      verifiedStats: stats,
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Format gate distribution
    const gateSummary = stats.gateStats
      .map(g => `${g.gateName}: ${g.count} attendees (${g.percentage}%)`)
      .join(', ');

    const prompt = `
You are the Eventra Event Insights Assistant. Answer the organizer's question using ONLY the verified event statistics below.

VERIFIED EVENT DATA:
- Event Name: ${stats.eventName}
- Total Capacity: ${stats.capacity}
- Total Registered Attendees: ${stats.totalRegistered}
- Total Checked-in Attendees: ${stats.totalCheckedIn}
- Remaining Available Capacity: ${stats.remainingCapacity}
- Attendance Rate: ${stats.attendanceRate}%
- No-show Count: ${stats.noShowCount} (${stats.noShowRate}%)
- Waitlisted Count: ${stats.waitlistCount}
- Cancelled Registrations: ${stats.cancelledCount}
- Suspicious Activity Incidents: ${stats.suspiciousCount}
- Peak Check-in Window: ${stats.peakCheckInWindow}
- Gate Breakdown: ${gateSummary || 'No gate check-in data yet'}

USER QUESTION: "${sanitizedQuestion}"

RULES:
- Answer accurately and concisely (2-4 sentences max).
- Use exact numbers from the data.
- If asked about peak times, gates, attendance percentage, or capacity, reference the verified numbers directly.
- Never speculate or invent unverified statistics.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const answerText = response.text?.trim();

    if (!answerText) {
      throw new Error('Empty response from Gemini');
    }

    return {
      answer: answerText,
      source: 'GEMINI_AI',
      verifiedStats: stats,
    };
  } catch (err: any) {
    console.warn('Gemini API call failed or timed out. Falling back to deterministic stats:', err.message);
    return {
      answer: formatDeterministicFallback(sanitizedQuestion, stats, `Gemini is temporarily unavailable (${err.message}).`),
      source: 'FALLBACK_VERIFIED_STATS',
      verifiedStats: stats,
    };
  }
}

function formatDeterministicFallback(question: string, stats: EventAnalytics, reason: string): string {
  const q = question.toLowerCase();

  let directAnswer = '';
  if (q.includes('how many') && q.includes('check')) {
    directAnswer = `**${stats.totalCheckedIn} attendees** have checked in so far (${stats.attendanceRate}% of registered attendees).`;
  } else if (q.includes('no-show') || q.includes('no show')) {
    directAnswer = `**${stats.noShowCount} registered attendees (${stats.noShowRate}%)** have not checked in yet.`;
  } else if (q.includes('peak')) {
    directAnswer = `Check-ins peaked at **${stats.peakCheckInWindow}**.`;
  } else if (q.includes('spot') || q.includes('left') || q.includes('capacity') || q.includes('remaining')) {
    directAnswer = `There are **${stats.remainingCapacity} spots remaining** out of ${stats.capacity} total capacity.`;
  } else if (q.includes('gate') || q.includes('busiest')) {
    const busiest = [...stats.gateStats].sort((a, b) => b.count - a.count)[0];
    directAnswer = busiest 
      ? `The busiest gate is **${busiest.gateName}** with **${busiest.count} check-ins** (${busiest.percentage}% of total).`
      : 'No check-in gate data is recorded yet.';
  } else if (q.includes('waitlist')) {
    directAnswer = `There are currently **${stats.waitlistCount} people** on the waitlist.`;
  } else if (q.includes('suspicious')) {
    directAnswer = `There have been **${stats.suspiciousCount} flagged suspicious activities** detected.`;
  } else {
    directAnswer = `Event **${stats.eventName}**: ${stats.totalCheckedIn} / ${stats.totalRegistered} checked in (${stats.attendanceRate}%), with ${stats.remainingCapacity} spots remaining and ${stats.suspiciousCount} suspicious incidents.`;
  }

  return `*Note: ${reason}*\n\n${directAnswer}\n\n**Verified Database Statistics:**\n- Checked in: **${stats.totalCheckedIn}**\n- Registered: **${stats.totalRegistered}**\n- Remaining capacity: **${stats.remainingCapacity}**\n- No-shows: **${stats.noShowCount}** (${stats.noShowRate}%)\n- Waitlist: **${stats.waitlistCount}**\n- Suspicious activity: **${stats.suspiciousCount}**`;
}
