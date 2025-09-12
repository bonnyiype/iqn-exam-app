import qa from '../../QuestionAnswers/QA.json';
import { Choice, ChoiceKey, ExamData, Question } from '../types';
import { shuffleInPlace } from './helpers';

type QAItem = {
  id: number;
  question_text: string;
  options: string[];
  correct_answer: string;
};

type QARoot = {
  exam_questions_set_1: QAItem[];
};

const KEY_ORDER: ChoiceKey[] = ['A', 'B', 'C', 'D', 'E'];

export function loadAllQAQuestions(): Question[] {
  const root = qa as unknown as QARoot;
  const source = Array.isArray(root.exam_questions_set_1) ? root.exam_questions_set_1 : [];

  return source.map((item) => {
    const choices: Choice[] = (item.options || []).slice(0, KEY_ORDER.length).map((text, idx) => ({
      key: KEY_ORDER[idx],
      text
    }));

    // Find correct key by matching text
    const correctIdx = choices.findIndex(c => normalize(c.text) === normalize(item.correct_answer));
    const correct: ChoiceKey[] = correctIdx >= 0 ? [KEY_ORDER[correctIdx]] : [];

    return {
      id: item.id,
      text: item.question_text,
      multi: false,
      choices,
      correct
    } as Question;
  });
}

// Partition all questions into 15 sets of up to 100 each, last set contains remainder
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
  // If any remaining questions after totalSets*setSize, push them into a final set
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
    version: 'qa-1.0'
  };
}

export function pickWithCoverage(
  allQuestions: Question[],
  existingOrder: number[] | undefined,
  cursor: number | undefined,
  sampleSize: number
): { selected: Question[]; order: number[]; cursor: number } {
  const allIds = allQuestions.map(q => q.id);
  let order = (existingOrder && existingOrder.length === allIds.length)
    ? existingOrder.slice()
    : shuffleInPlace(allIds);
  let ptr = typeof cursor === 'number' && cursor >= 0 && cursor < order.length ? cursor : 0;

  // If not enough remaining, wrap with a fresh shuffle to ensure coverage
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

  // Map ids to questions
  const idToQ = new Map(allQuestions.map(q => [q.id, q] as const));
  const selected = selectedIds.map(id => idToQ.get(id)!).filter(Boolean);

  return { selected, order, cursor: ptr };
}

function normalize(s: string): string {
  return String(s || '').trim().toLowerCase();
}


