import type { LicenseContext } from '../middleware/licenseAuth.js';
import { getQuestionPayload } from '../services/questionService.js';

const REFRESH_VALUES = new Set(['1', 'true', 'yes']);

export interface ExamQuestionsResponse {
  questions: Awaited<ReturnType<typeof getQuestionPayload>>['questions'];
  version: string;
  updatedAt: string;
  licensedTo?: {
    id: string;
    status: string;
  };
}

export async function buildExamQuestionsResponse(
  query: URLSearchParams,
  license: LicenseContext
): Promise<ExamQuestionsResponse> {
  const refreshParam = query.get('refresh');
  const forceRefresh = refreshParam ? REFRESH_VALUES.has(refreshParam.toLowerCase()) : false;
  const payload = await getQuestionPayload(forceRefresh);

  return {
    questions: payload.questions,
    version: payload.version,
    updatedAt: payload.updatedAt,
    licensedTo: {
      id: license.id,
      status: license.status
    }
  };
}
