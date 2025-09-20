export type ChoiceKey = "A" | "B" | "C" | "D" | "E";

export interface Choice {
  key: ChoiceKey;
  text: string;
}

export interface Question {
  id: number;
  text: string;
  multi: boolean;
  choices: Choice[];
  correct: ChoiceKey[];
  rationale?: string;
  category?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
}

export interface ExamData {
  title: string;
  questions: Question[];
  categories?: string[];
  totalTime?: number;
  createdAt?: string;
  version?: string;
}

export interface ExamSettings {
  minutes: number;
  passMark: number;
  shuffleQuestions: boolean;
  shuffleChoices: boolean;
  showRationalesOnReviewOnly: boolean;
  enableQuestionNavigation: boolean;
  enableFlagForReview: boolean;
  autoSaveProgress: boolean;
  showTimer: boolean;
  warnOnTimeRunningOut: boolean;
  timeWarningMinutes: number;
}

export interface ResultSummary {
  scorePct: number;
  correctCount: number;
  total: number;
  passed: boolean;
  categoryScores?: Record<string, number>;
  timeSpent?: number;
}

export interface ExamSession {
  examId: string;
  startTime: number;
  endTime?: number;
  answers: Record<number, ChoiceKey[]>;
  flaggedQuestions: number[];
  currentQuestion: number;
  isPaused: boolean;
  pausedTime: number;
}

export type Stage = 'builder' | 'exam' | 'review';

export interface ParseError {
  line?: number;
  message: string;
  type: 'warning' | 'error';
}

export type LicenseStatusValue = 'active' | 'trial' | 'revoked' | 'expired';

export interface LicenseInfo {
  licenseId: string;
  status: LicenseStatusValue;
  seatsTotal: number;
  seatsUsed: number;
  seatsRemaining: number;
  tier?: string;
  expiresAt?: string;
  renewalReminderAt?: string;
  renewalMessage?: string;
  ownerName?: string;
  ownerEmail?: string;
  totalDownloads?: number;
  lastUsageAt?: string;
}
