import { ExamData, ResultSummary, Question } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shuffleInPlace<T>(arr: T[]): T[] {
  const newArr = [...arr];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
}

export function calcSummary(
  exam: ExamData,
  selections: Record<number, string[]>,
  passMark: number,
  timeSpent?: number
): ResultSummary {
  let correctCount = 0;
  const categoryScores: Record<string, { correct: number; total: number }> = {};

  for (const q of exam.questions) {
    const picked = (selections[q.id] || []).slice().sort();
    const corr = q.correct.slice().sort();
    const isCorrect = picked.length === corr.length && picked.every((v, idx) => v === corr[idx]);
    
    if (isCorrect) correctCount++;

    // Track category scores
    if (q.category) {
      if (!categoryScores[q.category]) {
        categoryScores[q.category] = { correct: 0, total: 0 };
      }
      categoryScores[q.category].total++;
      if (isCorrect) categoryScores[q.category].correct++;
    }
  }

  const total = exam.questions.length;
  const scorePct = total ? Math.round((correctCount / total) * 100) : 0;

  // Convert category scores to percentages
  const categoryPercentages: Record<string, number> = {};
  Object.entries(categoryScores).forEach(([cat, scores]) => {
    categoryPercentages[cat] = Math.round((scores.correct / scores.total) * 100);
  });

  return {
    scorePct,
    correctCount,
    total,
    passed: scorePct >= passMark,
    categoryScores: categoryPercentages,
    timeSpent
  };
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatTimeSpent(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

export function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function toCSV(exam: ExamData, selections: Record<number, string[]>) {
  const rows = [
    ["Q#", "Question", "Category", "Difficulty", "Choices", "Correct", "Selected", "Result", "Rationale"],
    ...exam.questions.map(q => {
      const sel = (selections[q.id] || []).join(";");
      const corr = q.correct.join(";");
      const ok = sel.split(";").filter(Boolean).sort().join(";") === 
                 corr.split(";").filter(Boolean).sort().join(";") ? "Correct" : "Wrong";
      return [
        String(q.id),
        '"' + q.text.replace(/"/g, '""') + '"',
        q.category || "",
        q.difficulty || "",
        '"' + q.choices.map(c => `${c.key}) ${c.text}`).join(" | ").replace(/"/g, '""') + '"',
        corr,
        sel,
        ok,
        '"' + (q.rationale || "").replace(/"/g, '""') + '"'
      ];
    })
  ];
  return rows.map(r => r.join(",")).join("\n");
}

export function exportExamJSON(exam: ExamData, includeAnswers: boolean = true) {
  const exportData = { ...exam };
  if (!includeAnswers) {
    exportData.questions = exam.questions.map(q => ({
      ...q,
      correct: [],
      rationale: undefined
    }));
  }
  return JSON.stringify(exportData, null, 2);
}

export function getQuestionStats(questions: Question[]) {
  const stats = {
    total: questions.length,
    singleSelect: questions.filter(q => !q.multi).length,
    multiSelect: questions.filter(q => q.multi).length,
    byCategory: {} as Record<string, number>,
    byDifficulty: {
      easy: 0,
      medium: 0,
      hard: 0
    }
  };

  questions.forEach(q => {
    if (q.category) {
      stats.byCategory[q.category] = (stats.byCategory[q.category] || 0) + 1;
    }
    if (q.difficulty) {
      stats.byDifficulty[q.difficulty]++;
    }
  });

  return stats;
}
