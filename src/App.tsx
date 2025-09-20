import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, ListChecks, Moon, Sun, Github, LogOut, ShieldCheck, KeyRound, AlertCircle, Loader2 } from 'lucide-react';
import { ExamView, ReviewView } from './components';
import { Button, Badge, Card, CardHeader, CardTitle, CardDescription, CardContent } from './components/ui';
import { useExamStore } from './store/useExamStore';
import { useTimer } from './hooks/useTimer';
import { calcSummary, shuffleInPlace } from './utils/helpers';
import { loadAllQAQuestions, pickWithCoverage, buildExamFromQuestions, getExamSetQuestions } from './utils/qaLoader';

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
    setQACoverage,
    selectedSet,
    setSelectedSet,
    authStatus,
    license,
    authError,
    authLoading,
    licenseValidationPending,
    hasDismissedLicensePrompt,
    authenticateWithLicense,
    checkExistingSession,
    confirmLicense,
    signOut,
    setAuthError
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

  const [licenseInput, setLicenseInput] = useState('');

  const licenseExpiryText = React.useMemo(() => {
    if (!license?.expiresAt) return null;
    const expiry = new Date(license.expiresAt);
    if (Number.isNaN(expiry.getTime())) return null;
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(expiry);
  }, [license]);

  const isAuthBusy = authLoading || authStatus === 'loading';
  const shouldShowLicensePrompt =
    authStatus !== 'authenticated' &&
    (!hasDismissedLicensePrompt || (authStatus !== 'loading' && authStatus !== 'unknown'));

  useEffect(() => {
    if (authStatus === 'authenticated') {
      setLicenseInput('');
    }
  }, [authStatus]);

  const handleLicenseSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await authenticateWithLicense(licenseInput);
  };

  const handleLicenseInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (authError) {
      setAuthError(null);
    }
    setLicenseInput(event.target.value);
  };

  const handleSignOut = () => {
    void signOut();
  };

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

  // Check for any persisted session from the licensing server when the app mounts
  useEffect(() => {
    void checkExistingSession();
  }, [checkExistingSession]);

  // Remove fixed default duration; duration will be set to number of questions when building the exam

  const buildExamFromQA = React.useCallback(() => {
    const all = loadAllQAQuestions();
    let questions = getExamSetQuestions(all, selectedSet, 100, 15);
    const { order, cursor } = pickWithCoverage(questions, qaOrder || undefined, qaCursor, questions.length);
    questions = shuffleInPlace(questions);
    if (settings.shuffleChoices) {
      questions = questions.map(q => ({ ...q, choices: shuffleInPlace([...q.choices]) }));
    }
    const built = buildExamFromQuestions(questions, `IQN Practice Exam • Set ${selectedSet}`);
    setExam(built);
    if (settings.minutes !== 100) {
      updateSettings({ minutes: 100 });
    }
    setQACoverage(order, cursor);
    startSession(`exam_${Date.now()}`);
    setStage('exam');
  }, [
    qaOrder,
    qaCursor,
    selectedSet,
    settings.shuffleChoices,
    settings.minutes,
    setExam,
    updateSettings,
    setQACoverage,
    startSession,
    setStage
  ]);

  const handleStartNewExam = React.useCallback(async () => {
    const isValid = await confirmLicense();
    if (!isValid) {
      return;
    }
    buildExamFromQA();
  }, [confirmLicense, buildExamFromQA]);

  useEffect(() => {
    if (authStatus === 'authenticated' && !exam && !session && hasDismissedLicensePrompt) {
      void handleStartNewExam();
    }
  }, [authStatus, exam, session, hasDismissedLicensePrompt, handleStartNewExam]);

  // Ensure timer reflects current settings.minutes (number of questions) when exam starts
  useEffect(() => {
    if (stage === 'exam' && exam) {
      timer.reset();
      timer.start();
    }
  }, [stage, settings.minutes, exam]);

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

      <AnimatePresence>
        {shouldShowLicensePrompt && (
          <motion.div
            key="license-gate"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/70 backdrop-blur-md px-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-lg"
            >
              <Card className="shadow-2xl">
                <CardHeader className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 p-3 text-indigo-600 dark:text-indigo-300">
                      <ShieldCheck size={28} />
                    </div>
                    <div>
                      <CardTitle>Verify your license</CardTitle>
                      <CardDescription>
                        Enter a valid IQN practice license to unlock the exam workspace.
                      </CardDescription>
                    </div>
                  </div>

                  {authStatus === 'loading' && !authError && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Validating your existing session...
                    </div>
                  )}

                  {authStatus === 'expired' && license && (
                    <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-600 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                      <AlertCircle className="mt-0.5 h-4 w-4" />
                      <span>
                        License ending in {license.licenseKeyLast4}
                        {licenseExpiryText ? ` expired on ${licenseExpiryText}` : ' has expired'}. Enter a renewed key to continue.
                      </span>
                    </div>
                  )}

                  {authError && (
                    <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                      <AlertCircle className="mt-0.5 h-4 w-4" />
                      <span>{authError}</span>
                    </div>
                  )}
                </CardHeader>

                <CardContent className="space-y-6">
                  <form onSubmit={handleLicenseSubmit} className="space-y-4">
                    <label className="flex flex-col gap-2 text-sm text-gray-700 dark:text-gray-200">
                      License key
                      <div className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-400 dark:border-gray-700 dark:bg-gray-900">
                        <KeyRound className="h-4 w-4 text-indigo-500" />
                        <input
                          type="text"
                          value={licenseInput}
                          onChange={handleLicenseInputChange}
                          placeholder="e.g. IQN-VALID-0001"
                          className="flex-1 border-none bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100 dark:placeholder:text-gray-600"
                          disabled={isAuthBusy}
                          autoFocus
                        />
                      </div>
                    </label>

                    <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isAuthBusy}>
                      {isAuthBusy ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Checking key...
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="mr-2 h-4 w-4" />
                          Verify license
                        </>
                      )}
                    </Button>
                  </form>

                  <div className="rounded-xl bg-indigo-50 px-4 py-3 text-xs text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-200">
                    <p className="font-medium text-sm">Need a demo key?</p>
                    <p className="mt-1">Use <code className="font-mono text-xs">IQN-VALID-0001</code> when exploring locally.</p>
                    <p className="mt-2 text-[11px] text-indigo-500 dark:text-indigo-300">
                      Licensing is validated on the server—no secrets are stored in your browser.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
            
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-end">
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
                  disabled={authStatus !== 'authenticated' || !canNavigateTo('exam')}
                >
                  <Play size={18} />
                  <span className="hidden sm:inline">Exam</span>
                </Button>
                <Button
                  variant={stage === 'review' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setStage('review')}
                  disabled={authStatus !== 'authenticated' || !canNavigateTo('review')}
                >
                  <ListChecks size={18} />
                  <span className="hidden sm:inline">Review</span>
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => { void handleStartNewExam(); }}
                  disabled={authStatus !== 'authenticated' || licenseValidationPending}
                >
                  {licenseValidationPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  New Exam
                </Button>
                {license && authStatus === 'authenticated' && (
                  <Badge variant="success" size="sm" className="sm:hidden flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    Key • {license.licenseKeyLast4}
                  </Badge>
                )}
              </div>

              {license && authStatus === 'authenticated' && (
                <div className="flex flex-col items-center sm:items-end text-xs text-gray-600 dark:text-gray-400">
                  <span className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-200">
                    <ShieldCheck className="h-4 w-4 text-indigo-500 dark:text-indigo-300" />
                    Licensed to {license.owner}
                  </span>
                  {licenseExpiryText && (
                    <span>Expires {licenseExpiryText}</span>
                  )}
                  {license.plan && (
                    <span className="uppercase tracking-wide text-[10px] text-indigo-500 dark:text-indigo-300 mt-1">
                      {license.plan} plan • ending in {license.licenseKeyLast4}
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2">
                {authStatus === 'authenticated' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSignOut}
                    className="p-2 sm:px-3 sm:py-2"
                  >
                    <LogOut size={18} />
                    <span className="hidden sm:inline ml-1">Sign out</span>
                  </Button>
                )}

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
                onRestart={() => { void handleStartNewExam(); }}
                onRetake={() => { void handleStartNewExam(); }}
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
