import type { LicenseContext } from '../middleware/licenseAuth.js';
import { assertLicenseActive, ensureSeatAssignment, recordUsage } from '../services/licenseService.js';
import { getQuestionPayload } from '../services/questionService.js';
import { recordLicenseDownload } from '../utils/metrics.js';
import { sendJson } from '../utils/http.js';
import type { RequestContext } from './types.js';

const REFRESH_VALUES = new Set(['1', 'true', 'yes']);

export interface ExamQuestionsResponse {
  questions: Awaited<ReturnType<typeof getQuestionPayload>>['questions'];
  version: string;
  updatedAt: string;
  licensedTo: {
    id: string;
    status: string;
    seatsTotal: number;
    seatsUsed: number;
    seatsRemaining: number;
    tier?: string;
    expiresAt?: string;
    renewalReminderAt?: string;
    renewalMessage?: string;
  };
}

export async function handleExamQuestions(
  context: RequestContext,
  license: LicenseContext,
  seatId: string
): Promise<void> {
  const refreshParam = context.query.get('refresh');
  const forceRefresh = refreshParam ? REFRESH_VALUES.has(refreshParam.toLowerCase()) : false;

  const summary = assertLicenseActive(license.id);
  const seatSnapshot = ensureSeatAssignment(summary.licenseId, seatId, license.name);
  const payload = await getQuestionPayload(forceRefresh);

  const clientIp = context.req.socket?.remoteAddress ?? 'unknown';
  recordUsage(summary.licenseId, 'questions.download', {
    ip: clientIp,
    userAgent: context.req.headers['user-agent'],
    seatId
  }, seatId);
  recordLicenseDownload(summary.licenseId);

  const response: ExamQuestionsResponse = {
    questions: payload.questions,
    version: payload.version,
    updatedAt: payload.updatedAt,
    licensedTo: {
      id: summary.licenseId,
      status: summary.status,
      seatsTotal: summary.seatsTotal,
      seatsUsed: seatSnapshot.seatsUsed,
      seatsRemaining: seatSnapshot.seatsRemaining,
      tier: summary.tier,
      expiresAt: summary.expiresAt,
      renewalReminderAt: summary.renewalReminderAt,
      renewalMessage: summary.renewalMessage
    }
  };

  sendJson(context.res, 200, response, { cacheControl: 'private, max-age=120' });
}
