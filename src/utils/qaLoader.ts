import { Choice, ChoiceKey, ExamData, Question } from '../types';
import { shuffleInPlace } from './helpers';

type QAItem = {
  id: number;
  question_text: string;
  options: string[];
  correct_answer: string;
};

type QuestionsResponse = {
  questions?: QAItem[];
  version?: string;
  updatedAt?: string;
};

const KEY_ORDER: ChoiceKey[] = ['A', 'B', 'C', 'D', 'E'];
const LICENSE_TOKEN_KEYS = ['iqn_license_token', 'licenseToken', 'iqnLicense'];

let cachedQuestions: Question[] | null = null;
let pendingRequest: Promise<Question[]> | null = null;
let questionBankVersion = 'qa-1.0';

export async function loadAllQAQuestions(forceRefresh = false): Promise<Question[]> {
  if (!forceRefresh && cachedQuestions) {
    return cachedQuestions;
  }

  if (!forceRefresh && pendingRequest) {
    return pendingRequest;
  }

  pendingRequest = fetchQuestionsFromApi(forceRefresh)
    .then((questions) => {
      cachedQuestions = questions;
      return questions;
    })
    .finally(() => {
      pendingRequest = null;
    });

  return pendingRequest;
}

export function getQuestionBankVersion(): string {
  return questionBankVersion;
}

async function fetchQuestionsFromApi(forceRefresh: boolean): Promise<Question[]> {
  const headers: HeadersInit = {
    Accept: 'application/json'
  };

  const token = readLicenseToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const baseUrl = getApiBaseUrl();
  const refreshSuffix = forceRefresh ? '?refresh=true' : '';
  const endpoint = `${baseUrl}/api/exams/questions${refreshSuffix}`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'GET',
      headers,
      credentials: 'include',
      cache: 'no-store'
    });
  } catch {
    throw new Error('Unable to reach the exam server. Please verify your connection and try again.');
  }

  if (response.status === 401) {
    throw new Error('You must be signed in with a valid IQN license to access the exam bank.');
  }

  if (response.status === 403) {
    throw new Error('Your IQN license is not authorized to download exam questions.');
  }

  if (!response.ok) {
    const serverMessage = await readServerError(response);
    throw new Error(serverMessage ?? `Unable to load IQN exam questions (HTTP ${response.status}).`);
  }

  const payload = (await response.json()) as QuestionsResponse;
  if (typeof payload.version === 'string' && payload.version.trim().length > 0) {
    questionBankVersion = payload.version.trim();
  }

  const source = Array.isArray(payload.questions) ? payload.questions : [];
  return source
    .map((item) => mapToQuestion(item))
    .filter((question): question is Question => Boolean(question));
}

function getApiBaseUrl(): string {
  const raw = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_API_BASE_URL;
  if (!raw) {
    return '';
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return '';
  }

  return trimmed.replace(/\/+$/, '');
}

function readLicenseToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  for (const key of LICENSE_TOKEN_KEYS) {
    const localValue = window.localStorage.getItem(key);
    if (localValue) {
      return localValue;
    }
    const sessionValue = window.sessionStorage.getItem(key);
    if (sessionValue) {
      return sessionValue;
    }
  }

  return null;
}

async function readServerError(response: Response): Promise<string | null> {
  try {
    const clone = response.clone();
    const contentType = clone.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await clone.json() as { message?: string; error?: string; details?: string };
      if (typeof data.message === 'string' && data.message.trim().length > 0) {
        return data.message.trim();
      }
      if (typeof data.error === 'string' && data.error.trim().length > 0) {
        return data.error.trim();
      }
      if (typeof data.details === 'string' && data.details.trim().length > 0) {
        return data.details.trim();
      }
    } else {
      const text = await clone.text();
      if (text.trim().length > 0) {
        return text.trim();
      }
    }
  } catch {
    // Ignore secondary parsing errors.
  }

  return null;
}

function mapToQuestion(item: QAItem): Question | null {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const id = typeof item.id === 'number' && Number.isFinite(item.id)
    ? item.id
    : Number(item.id);

  if (!Number.isFinite(id)) {
    return null;
  }

  const text = typeof item.question_text === 'string' ? item.question_text.trim() : '';
  if (!text) {
    return null;
  }

  const choices: Choice[] = Array.isArray(item.options)
    ? item.options.slice(0, KEY_ORDER.length).map((option, idx) => {
        const value = typeof option === 'string' ? option.trim() : String(option ?? '').trim();
        if (!value) {
          return null;
        }
        return {
          key: KEY_ORDER[idx],
          text: value
        } as Choice;
      }).filter((choice): choice is Choice => Boolean(choice))
    : [];

  if (choices.length === 0) {
    return null;
  }

  const correctIdx = choices.findIndex((choice) => normalize(choice.text) === normalize(item.correct_answer));
  const correct: ChoiceKey[] = correctIdx >= 0 ? [choices[correctIdx].key] : [];

  return {
    id,
    text,
    multi: false,
    choices,
    correct
  } as Question;
}

export function partitionIntoSets(all: Question[], setSize = 100, totalSets = 15): Question[][] {
  const sorted = [...all].sort((a, b) => a.id - b.id);
  const sets: Question[][] = [];
  let idx = 0;
  for (let s = 0; s < totalSets; s++) {
    const slice = sorted.slice(idx, idx + setSize);
    if (slice.length === 0) break;
    sets.push(slice);
    idx += setSize;
  }
  if (idx < sorted.length) {
    sets.push(sorted.slice(idx));
  }
  return sets;
}

export function getExamSetQuestions(all: Question[], setNumber: number, setSize = 100, totalSets = 15): Question[] {
  const sets = partitionIntoSets(all, setSize, totalSets);
  const index = Math.max(1, Math.min(setNumber, sets.length)) - 1;
  return sets[index] || [];
}

export function buildExamFromQuestions(questions: Question[], title = 'IQN Exam'): ExamData {
  return {
    title,
    questions,
    createdAt: new Date().toISOString(),
    version: questionBankVersion
  };
}

export function pickWithCoverage(
  allQuestions: Question[],
  existingOrder: number[] | undefined,
  cursor: number | undefined,
  sampleSize: number
): { selected: Question[]; order: number[]; cursor: number } {
  const allIds = allQuestions.map((q) => q.id);
  let order = existingOrder && existingOrder.length === allIds.length
    ? existingOrder.slice()
    : shuffleInPlace(allIds);
  let ptr = typeof cursor === 'number' && cursor >= 0 && cursor < order.length ? cursor : 0;

  const remaining = order.length - ptr;
  let selectedIds: number[] = [];
  if (remaining >= sampleSize) {
    selectedIds = order.slice(ptr, ptr + sampleSize);
    ptr += sampleSize;
  } else {
    const part1 = order.slice(ptr);
    order = shuffleInPlace(allIds);
    const needed = sampleSize - part1.length;
    const part2 = order.slice(0, needed);
    selectedIds = part1.concat(part2);
    ptr = needed;
  }

  const idToQ = new Map(allQuestions.map((q) => [q.id, q] as const));
  const selected = selectedIds.map((id) => idToQ.get(id)!).filter(Boolean);

  return { selected, order, cursor: ptr };
}

function normalize(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}
