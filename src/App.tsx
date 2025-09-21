import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, ListChecks, Moon, Sun, Github } from 'lucide-react';
import { ExamView, ReviewView } from './components';
import { Button, Badge } from './components/ui';
import { useExamStore } from './store/useExamStore';
import { useTimer } from './hooks/useTimer';
import { calcSummary, shuffleInPlace } from './utils/helpers';
import { loadAllQAQuestions, pickWithCoverage, buildExamFromQuestions, getExamSetQuestions } from './utils/qaLoader';

function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' ||
           (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  const [isFetchingQuestions, setIsFetchingQuestions] = useState(false);
  const [questionLoadError, setQuestionLoadError] = useState<string | null>(null);

  const {
    stage,
    exam,
    settings,
    session,
    // testReport,
    setStage,
    setExam,
    updateSettings,
    startSession,
    updateAnswers,
    flagQuestion,
    unflagQuestion,
    setCurrentQuestion,
    pauseSession,
    resumeSession,
    endSession,
    // resetAll,
    qaOrder,
    qaCursor,
    setQACoverage,
    selectedSet,
    setSelectedSet
  } = useExamStore();

  const timer = useTimer({
    duration: settings.minutes * 60,
    onTimeUp: () => {
      if (stage === 'exam') {
        submitExam();
      }
    },
    onWarning: () => {
      // Handle warning
    },
    warningTime: settings.timeWarningMinutes * 60
  });

  const { reset: resetTimer, start: startTimer } = timer;

  // Dark mode effect
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Always start a fresh exam from QA.json on first mount (ensures new set on refresh)
  useEffect(() => {
    void startNewExamFromQA();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Remove fixed default duration; duration will be set to number of questions when building the exam

  // Start a new exam from QA.json using questions for the selected set
  const startNewExamFromQA = React.useCallback(async () => {
    setIsFetchingQuestions(true);
    setQuestionLoadError(null);

    try {
      const all = await loadAllQAQuestions();
      if (!Array.isArray(all) || all.length === 0) {
        throw new Error('No questions are available for download.');
      }

      let questions = getExamSetQuestions(all, selectedSet, 100, 15);
      if (!questions.length) {
        throw new Error(`No questions found for Set ${selectedSet}.`);
      }

      const { order, cursor } = pickWithCoverage(questions, qaOrder || undefined, qaCursor, questions.length);
      questions = shuffleInPlace(questions);
      if (settings.shuffleChoices) {
        questions = questions.map(q => ({ ...q, choices: shuffleInPlace([...q.choices]) }));
      }

      const built = buildExamFromQuestions(questions, `IQN Practice Exam • Set ${selectedSet}`);
      setExam(built);

      const derivedMinutes = built.questions.length;
      if (settings.minutes !== derivedMinutes) {
        updateSettings({ minutes: derivedMinutes });
      }

      setQACoverage(order, cursor);
      startSession(`exam_${Date.now()}`);
      setStage('exam');
    } catch (error) {
      console.error('Failed to load IQN questions from the server', error);
      const message = error instanceof Error ? error.message : 'Unable to load IQN questions. Please try again.';
      setQuestionLoadError(message);
    } finally {
      setIsFetchingQuestions(false);
    }
  }, [loadAllQAQuestions, qaCursor, qaOrder, selectedSet, setExam, setQACoverage, setStage, settings.minutes, settings.shuffleChoices, startSession, updateSettings]);

  // Ensure timer reflects current settings.minutes (number of questions) when exam starts
  useEffect(() => {
    if (stage === 'exam' && exam) {
      resetTimer();
      startTimer();
    }
  }, [stage, settings.minutes, exam, resetTimer, startTimer]);

  // Handle answer selection
  const pickAnswer = (question: any, key: any) => {
    if (!session) return;
    
    const current = session.answers[question.id] || [];
    let next: any[];
    
    if (question.multi) {
      next = current.includes(key) 
        ? current.filter(k => k !== key) 
        : [...current, key];
    } else {
      next = [key];
    }
    
    updateAnswers(question.id, next);
  };

  // Submit exam
  const submitExam = () => {
    if (!exam || !session) return;
    
    timer.stop();
    endSession();
    setStage('review');
  };

  // Calculate summary for review
  const summary = React.useMemo(() => {
    if (!exam || !session) return null;
    
    const timeSpent = session.endTime 
      ? (session.endTime - session.startTime - session.pausedTime)
      : undefined;
    
    return calcSummary(exam, session.answers, settings.passMark, timeSpent);
  }, [exam, session, settings.passMark]);

  // Handle stage navigation
  const canNavigateTo = (targetStage: string) => {
    if (targetStage === 'exam') return exam !== null;
    if (targetStage === 'review') return Boolean(session && (session as any).endTime);
    return true;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-950 dark:via-black dark:to-gray-950 transition-colors duration-300">
      {/* Background Pattern */}
      <div className="fixed inset-0 opacity-20 dark:opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, currentColor 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }} />
      </div>

      <div className="relative max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <header className="mb-8">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row items-center justify-between gap-4"
          >
            <div className="text-center sm:text-left">
              <h1 className="text-3xl sm:text-4xl font-bold gradient-text mb-2">
                IQN Mock Exam
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Realistic, timed IQN mock from the local question bank
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Stage Navigation (Builder removed) */}
              <div className="flex items-center gap-2 p-1 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm rounded-xl">
                <select
                  value={selectedSet}
                  onChange={(e) => setSelectedSet(Number(e.target.value))}
                  className="text-sm rounded-lg bg-white/70 dark:bg-gray-900/60 border border-gray-300 dark:border-gray-700 px-2 py-1"
                  aria-label="Select Exam Set"
                >
                  {Array.from({ length: 15 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>Set {n}</option>
                  ))}
                  <option value={16}>Set 16 (Remainder)</option>
                </select>
                <Button
                  variant={stage === 'exam' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setStage('exam')}
                  disabled={!canNavigateTo('exam')}
                >
                  <Play size={18} />
                  <span className="hidden sm:inline">Exam</span>
                </Button>
                <Button
                  variant={stage === 'review' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setStage('review')}
                  disabled={!canNavigateTo('review')}
                >
                  <ListChecks size={18} />
                  <span className="hidden sm:inline">Review</span>
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => { void startNewExamFromQA(); }}
                  disabled={isFetchingQuestions}
                  aria-busy={isFetchingQuestions}
                >
                  {isFetchingQuestions ? 'Loading…' : 'New Exam'}
                </Button>
              </div>

              {/* Dark Mode Toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2"
              >
                <AnimatePresence mode="wait">
                  {isDarkMode ? (
                    <motion.div
                      key="moon"
                      initial={{ rotate: -90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: 90, opacity: 0 }}
                    >
                      <Moon size={20} />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="sun"
                      initial={{ rotate: 90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: -90, opacity: 0 }}
                    >
                      <Sun size={20} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </Button>
            </div>
          </motion.div>
        </header>

        {questionLoadError && (
          <div className="mb-6">
            <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
              <p className="font-semibold">Unable to load exam questions</p>
              <p className="mt-1 text-sm">{questionLoadError}</p>
            </div>
          </div>
        )}

        {isFetchingQuestions && (
          <div className="mb-6">
            <div className="rounded-xl border border-indigo-200 bg-white/70 p-4 text-indigo-700 shadow-sm dark:border-indigo-800 dark:bg-gray-900/40 dark:text-indigo-200">
              <p className="font-medium">Preparing your exam set…</p>
              <p className="mt-1 text-sm text-indigo-600/80 dark:text-indigo-200/70">
                Fetching the latest IQN questions for Set {selectedSet}.
              </p>
            </div>
          </div>
        )}

        {/* Main Content */}
        <AnimatePresence mode="wait">
          {stage === 'exam' && exam && session && (
            <motion.div
              key="exam"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <ExamView
                exam={exam}
                index={session.currentQuestion}
                setIndex={setCurrentQuestion}
                answers={session.answers}
                flaggedQuestions={session.flaggedQuestions}
                pick={pickAnswer}
                toggleFlag={(id) => {
                  if (session.flaggedQuestions.includes(id)) {
                    unflagQuestion(id);
                  } else {
                    flagQuestion(id);
                  }
                }}
                submit={submitExam}
                minutesLeft={timer.minutes}
                secondsLeft={timer.seconds}
                isPaused={session.isPaused}
                onPause={() => {
                  pauseSession();
                  timer.pause();
                }}
                onResume={() => {
                  resumeSession();
                  timer.resume();
                }}
                settings={settings}
              />
            </motion.div>
          )}

          {stage === 'review' && exam && session && summary && (
            <motion.div
              key="review"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <ReviewView
                exam={exam}
                answers={session.answers}
                flaggedQuestions={session.flaggedQuestions}
                summary={summary}
                onRestart={() => { void startNewExamFromQA(); }}
                onRetake={() => { void startNewExamFromQA(); }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <footer className="mt-16 pb-8 text-center">
          <div className="flex items-center justify-center gap-6 mb-4">
            <Badge variant="secondary" className="px-3 py-1">
              Version 2.0
            </Badge>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              <Github size={20} />
            </a>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Built with React, TypeScript, and Tailwind CSS • Supports up to 150 questions
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
            © 2025 IQN Practice Exam Builder. Create and practice with confidence.
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;
