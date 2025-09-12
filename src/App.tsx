import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, ListChecks, Moon, Sun, Github } from 'lucide-react';
import { ExamView, ReviewView } from './components';
import { Button, Badge } from './components/ui';
import { useExamStore } from './store/useExamStore';
import { useTimer } from './hooks/useTimer';
import { calcSummary, shuffleInPlace } from './utils/helpers';
import { loadAllQAQuestions, pickWithCoverage, buildExamFromQuestions } from './utils/qaLoader';

function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' || 
           (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

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
    setQACoverage
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
    startNewExamFromQA();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Remove fixed default duration; duration will be set to number of questions when building the exam

  // Start a new exam from QA.json using ALL available questions
  const startNewExamFromQA = () => {
    const all = loadAllQAQuestions();
    const sampleSize = all.length;
    const { selected, order, cursor } = pickWithCoverage(all, qaOrder || undefined, qaCursor, sampleSize);
    let questions = shuffleInPlace(selected);
    if (settings.shuffleChoices) {
      questions = questions.map(q => ({ ...q, choices: shuffleInPlace([...q.choices]) }));
    }
    const built = buildExamFromQuestions(questions, 'IQN Practice Exam');
    setExam(built);
    // Set duration to number of questions (minutes)
    if (settings.minutes !== questions.length) {
      updateSettings({ minutes: questions.length });
    }
    setQACoverage(order, cursor);
    startSession(`exam_${Date.now()}`);
    setStage('exam');
    timer.reset();
    timer.start();
  };

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
                  onClick={() => startNewExamFromQA()}
                >
                  New Exam
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
                onRestart={() => startNewExamFromQA()}
                onRetake={() => startNewExamFromQA()}
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
