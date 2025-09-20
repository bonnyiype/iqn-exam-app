import fs from 'fs/promises';
import path from 'path';

export interface QAItem {
  id: number;
  question_text: string;
  options: string[];
  correct_answer: string;
}

interface QARoot {
  exam_questions_set_1?: unknown;
}

export interface QuestionServiceResult {
  questions: QAItem[];
  version: string;
  updatedAt: string;
}

const DATA_VERSION = process.env.QA_DATA_VERSION || 'qa-1.0';
const DATA_PATH = process.env.QA_DATA_PATH
  ? path.resolve(process.cwd(), process.env.QA_DATA_PATH)
  : path.resolve(process.cwd(), 'QuestionAnswers', 'QA.json');

let cache: QuestionServiceResult | null = null;
let inflight: Promise<QuestionServiceResult> | null = null;

export async function getQuestionPayload(forceRefresh = false): Promise<QuestionServiceResult> {
  if (!forceRefresh && cache) {
    return cache;
  }

  if (!forceRefresh && inflight) {
    return inflight;
  }

  inflight = loadQuestionsFromDisk()
    .then((result) => {
      cache = result;
      return result;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function clearQuestionCache(): void {
  cache = null;
  inflight = null;
}

async function loadQuestionsFromDisk(): Promise<QuestionServiceResult> {
  const raw = await fs.readFile(DATA_PATH, 'utf8');

  let parsed: QARoot;
  try {
    parsed = JSON.parse(raw) as QARoot;
  } catch (error) {
    throw new Error(`Unable to parse question data at ${DATA_PATH}: ${(error as Error).message}`);
  }

  const questions = sanitizeQuestionArray(parsed.exam_questions_set_1);
  const updatedAt = new Date().toISOString();

  return {
    questions,
    version: DATA_VERSION,
    updatedAt
  };
}

function sanitizeQuestionArray(value: unknown): QAItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const sanitized: QAItem[] = [];
  for (const item of value) {
    const question = sanitizeQuestion(item);
    if (question) {
      sanitized.push(question);
    }
  }

  return sanitized.sort((a, b) => a.id - b.id);
}

function sanitizeQuestion(item: unknown): QAItem | null {
  if (typeof item !== 'object' || !item) {
    return null;
  }

  const record = item as Record<string, unknown>;

  const idRaw = record.id;
  const questionTextRaw = record.question_text ?? record.question;
  const optionsRaw = record.options;
  const correctAnswerRaw = record.correct_answer ?? record.answer;

  const id = typeof idRaw === 'number' && Number.isFinite(idRaw)
    ? idRaw
    : typeof idRaw === 'string'
      ? Number.parseInt(idRaw, 10)
      : NaN;

  if (!Number.isFinite(id)) {
    return null;
  }

  const questionText = typeof questionTextRaw === 'string' ? questionTextRaw.trim() : '';
  if (!questionText) {
    return null;
  }

  const options = Array.isArray(optionsRaw)
    ? optionsRaw.map((option) => (typeof option === 'string' ? option.trim() : String(option ?? '')).trim()).filter(Boolean)
    : [];

  if (options.length === 0) {
    return null;
  }

  const correctAnswer = typeof correctAnswerRaw === 'string'
    ? correctAnswerRaw.trim()
    : String(correctAnswerRaw ?? '').trim();

  return {
    id,
    question_text: questionText,
    options,
    correct_answer: correctAnswer
  };
}
