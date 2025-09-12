import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, ChevronRight, Timer, Flag, Pause, Play, 
  AlertCircle, CheckCircle2, Circle, Square, Eye
} from 'lucide-react';
import { Button, Card, CardContent, Badge, Progress, Modal } from '../ui';
import { ExamData, Question, ChoiceKey } from '../../types';
import { cn, formatTime } from '../../utils/helpers';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';

interface ExamViewProps {
  exam: ExamData;
  index: number;
  setIndex: (v: number) => void;
  answers: Record<number, ChoiceKey[]>;
  flaggedQuestions: number[];
  pick: (q: Question, key: ChoiceKey) => void;
  toggleFlag: (questionId: number) => void;
  submit: () => void;
  minutesLeft: number;
  secondsLeft: number;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  settings: {
    showTimer: boolean;
    enableQuestionNavigation: boolean;
    enableFlagForReview: boolean;
  };
}

export const ExamView: React.FC<ExamViewProps> = ({
  exam,
  index,
  setIndex,
  answers,
  flaggedQuestions,
  pick,
  toggleFlag,
  submit,
  minutesLeft,
  secondsLeft,
  isPaused,
  onPause,
  onResume,
  settings
}) => {
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showTimeWarning, setShowTimeWarning] = useState(false);
  const [reveal, setReveal] = useState<Record<number, boolean>>({});
  const q = exam.questions[index];
  const selected = answers[q.id] || [];
  const isFlagged = flaggedQuestions.includes(q.id);
  const progress = ((index + 1) / exam.questions.length) * 100;
  const answeredCount = Object.keys(answers).length;
  const totalSeconds = minutesLeft * 60 + secondsLeft;

  // Show time warning when 5 minutes left
  useEffect(() => {
    if (totalSeconds <= 300 && totalSeconds > 295 && !showTimeWarning) {
      setShowTimeWarning(true);
      setTimeout(() => setShowTimeWarning(false), 5000);
    }
  }, [totalSeconds, showTimeWarning]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    ArrowRight: () => setIndex(Math.min(exam.questions.length - 1, index + 1)),
    ArrowLeft: () => setIndex(Math.max(0, index - 1)),
    'Ctrl+Enter': () => setShowSubmitModal(true),
    f: () => settings.enableFlagForReview && toggleFlag(q.id),
    ' ': () => isPaused ? onResume() : onPause(),
    a: () => q.choices.some(c => c.key === 'A') && pick(q, 'A'),
    b: () => q.choices.some(c => c.key === 'B') && pick(q, 'B'),
    c: () => q.choices.some(c => c.key === 'C') && pick(q, 'C'),
    d: () => q.choices.some(c => c.key === 'D') && pick(q, 'D'),
    e: () => q.choices.some(c => c.key === 'E') && pick(q, 'E'),
  }, !isPaused);

  const isCorrectKey = (key: ChoiceKey) => (q.correct || []).includes(key);

  const handleReveal = () => {
    setReveal(prev => ({ ...prev, [q.id]: true }));
  };

  const handleSubmit = () => {
    setShowSubmitModal(false);
    submit();
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6"
      >
        {/* Timer Warning */}
        <AnimatePresence>
          {showTimeWarning && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-4 right-4 z-50"
            >
              <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700">
                <CardContent className="p-4 flex items-center gap-3">
                  <AlertCircle className="text-amber-600" size={20} />
                  <span className="font-medium text-amber-800 dark:text-amber-200">
                    5 minutes remaining!
                  </span>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Question Card */}
        <Card animated glass className="relative overflow-hidden">
          {isPaused && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10 flex items-center justify-center">
              <div className="text-center">
                <Pause className="w-16 h-16 text-white mb-4 mx-auto" />
                <p className="text-xl font-semibold text-white mb-4">Exam Paused</p>
                <Button onClick={onResume} variant="primary">
                  <Play size={18} />
                  Resume Exam
                </Button>
              </div>
            </div>
          )}

          <CardContent className="p-6 lg:p-8">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <Badge variant="secondary" size="lg">
                  Question {index + 1} / {exam.questions.length}
                </Badge>
                {q.multi && (
                  <Badge variant="info" size="lg">
                    Multiple Select
                  </Badge>
                )}
                {isFlagged && (
                  <Badge variant="warning" size="lg">
                    <Flag size={14} />
                    Flagged
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReveal}
                  disabled={!q.correct || q.correct.length === 0 || reveal[q.id]}
                  title={(!q.correct || q.correct.length === 0) ? 'No answer data available' : 'Reveal correct answer'}
                >
                  <Eye size={16} />
                  Show Answer
                </Button>
                {settings.showTimer && (
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={isPaused ? onResume : onPause}
                    >
                      {isPaused ? <Play size={18} /> : <Pause size={18} />}
                    </Button>
                    <div className={cn(
                      "flex items-center gap-2 font-mono text-lg",
                      totalSeconds < 300 && "text-red-600 dark:text-red-400"
                    )}>
                      <Timer size={20} />
                      <span>{formatTime(totalSeconds)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Progress */}
            <Progress 
              value={progress} 
              variant={progress === 100 ? "success" : "default"}
              gradient
              className="mb-8"
            />

            {/* Question */}
            <div className="mb-8">
              <h3 className="text-xl lg:text-2xl font-medium leading-relaxed text-gray-900 dark:text-gray-100">
                {q.text}
              </h3>
              {reveal[q.id] && q.correct && q.correct.length > 0 && (
                <div className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
                  Correct: {q.correct.join(', ')}
                </div>
              )}
              {q.category && (
                <Badge variant="secondary" className="mt-2">
                  {q.category}
                </Badge>
              )}
            </div>

            {/* Choices */}
            <div className="space-y-3">
              {q.choices.map((choice) => {
                const isSelected = selected.includes(choice.key);
                const isCorrect = reveal[q.id] && isCorrectKey(choice.key);
                const Icon = q.multi ? (isSelected ? CheckCircle2 : Square) : (isSelected ? Circle : Circle);
                
                return (
                  <motion.button
                    key={choice.key}
                    type="button"
                    onClick={() => pick(q, choice.key)}
                    className={cn(
                      "w-full text-left p-4 rounded-xl border-2 transition-all",
                      "flex items-start gap-3 group",
                      isSelected
                        ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500 dark:border-indigo-400"
                        : "bg-white dark:bg-gray-900/50 border-gray-200 dark:border-gray-700",
                      isCorrect && "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-900/20",
                      "hover:border-indigo-400 dark:hover:border-indigo-500",
                      "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    )}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <Icon 
                      size={20} 
                      className={cn(
                        "mt-0.5 flex-shrink-0 transition-colors",
                        isSelected 
                          ? "text-indigo-600 dark:text-indigo-400" 
                          : "text-gray-400 dark:text-gray-600 group-hover:text-indigo-500"
                      )}
                    />
                    <div className="flex-1">
                      <span className={cn(
                        "font-semibold mr-2",
                        isSelected && "text-indigo-700 dark:text-indigo-300"
                      )}>
                        {choice.key})
                      </span>
                      <span className={cn(
                        isSelected && "text-indigo-900 dark:text-indigo-100"
                      )}>
                        {choice.text}
                      </span>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {/* Actions */}
            <div className="mt-8 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  disabled={index === 0}
                  onClick={() => setIndex(Math.max(0, index - 1))}
                >
                  <ChevronLeft size={18} />
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  disabled={index === exam.questions.length - 1}
                  onClick={() => setIndex(Math.min(exam.questions.length - 1, index + 1))}
                >
                  Next
                  <ChevronRight size={18} />
                </Button>
                {settings.enableFlagForReview && (
                  <Button
                    variant="ghost"
                    onClick={() => toggleFlag(q.id)}
                    className={cn(
                      isFlagged && "text-amber-600 dark:text-amber-400"
                    )}
                  >
                    <Flag size={18} />
                    {isFlagged ? 'Unflag' : 'Flag'}
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {answeredCount} / {exam.questions.length} answered
                </span>
                <Button
                  variant="success"
                  onClick={() => setShowSubmitModal(true)}
                >
                  <CheckCircle2 size={18} />
                  Submit Exam
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Question Navigation Grid */}
        {settings.enableQuestionNavigation && (
          <Card animated>
            <CardContent className="p-6">
              <h4 className="font-semibold mb-4">Question Navigation</h4>
              <div className="flex flex-wrap gap-2">
                {exam.questions.map((question, idx) => {
                  const isAnswered = (answers[question.id] || []).length > 0;
                  const isCurrentQuestion = idx === index;
                  const isQuestionFlagged = flaggedQuestions.includes(question.id);
                  
                  return (
                    <motion.button
                      key={question.id}
                      onClick={() => setIndex(idx)}
                      className={cn(
                        "w-10 h-10 rounded-lg text-sm font-semibold",
                        "flex items-center justify-center relative",
                        "transition-all focus:outline-none focus:ring-2 focus:ring-offset-2",
                        isCurrentQuestion && "ring-2 ring-indigo-500",
                        isAnswered
                          ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300",
                        "hover:bg-indigo-100 dark:hover:bg-indigo-900/30"
                      )}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {idx + 1}
                      {isQuestionFlagged && (
                        <Flag className="absolute -top-1 -right-1 w-3 h-3 text-amber-600" />
                      )}
                    </motion.button>
                  );
                })}
              </div>
              
              {/* Legend */}
              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-gray-100 dark:bg-gray-800" />
                  <span className="text-gray-600 dark:text-gray-400">Unanswered</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-emerald-100 dark:bg-emerald-900/30" />
                  <span className="text-gray-600 dark:text-gray-400">Answered</span>
                </div>
                <div className="flex items-center gap-2">
                  <Flag className="w-4 h-4 text-amber-600" />
                  <span className="text-gray-600 dark:text-gray-400">Flagged</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* Submit Confirmation Modal */}
      <Modal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        title="Submit Exam?"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Are you sure you want to submit your exam?
          </p>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Questions answered:</span>
              <span className="font-semibold">
                {answeredCount} / {exam.questions.length}
              </span>
            </div>
            {flaggedQuestions.length > 0 && (
              <div className="flex justify-between text-sm">
                <span>Flagged questions:</span>
                <span className="font-semibold text-amber-600">
                  {flaggedQuestions.length}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span>Time remaining:</span>
              <span className="font-semibold">
                {formatTime(totalSeconds)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => setShowSubmitModal(false)}
              className="flex-1"
            >
              Continue Exam
            </Button>
            <Button
              variant="success"
              onClick={handleSubmit}
              className="flex-1"
            >
              Submit Now
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
