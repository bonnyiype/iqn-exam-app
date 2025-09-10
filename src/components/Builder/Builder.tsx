import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Upload, FileText, ClipboardPaste, Settings, Play, 
  ListChecks, Beaker, AlertCircle, CheckCircle 
} from 'lucide-react';
import { Button, Card, CardHeader, CardTitle, CardContent, Toggle, Badge, Modal } from '../ui';
import { parseMock } from '../../utils/parser';
import { ExamSettings, ParseError } from '../../types';
import { SAMPLE_TEXT } from '../../utils/sampleData';
import { cn } from '../../utils/helpers';

interface BuilderProps {
  raw: string;
  setRaw: (v: string) => void;
  settings: ExamSettings;
  setSettings: (s: ExamSettings) => void;
  onBuild: () => void;
  onRunTests: () => void;
  testReport: any | null;
}

export const Builder: React.FC<BuilderProps> = ({
  raw,
  setRaw,
  settings,
  setSettings,
  onBuild,
  onRunTests,
  testReport
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parseErrors, setParseErrors] = useState<ParseError[]>([]);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  const handleParse = () => {
    try {
      const { exam, errors } = parseMock(raw);
      setParseErrors(errors);
      if (errors.length === 0) {
        alert(`Successfully parsed ${exam.questions.length} questions!`);
      }
    } catch (e: any) {
      setParseErrors([{ message: e.message, type: 'error' }]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = () => setRaw(String(reader.result));
    reader.readAsText(file);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Input Section */}
      <Card animated glass>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                <Upload className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <CardTitle>Add Your Mock Test</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setRaw(SAMPLE_TEXT)}
              >
                <ClipboardPaste size={16} />
                Load Sample
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                <FileText size={16} />
                Upload .txt
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.md,.text"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={16}
              className={cn(
                "w-full rounded-xl border p-4 font-mono text-sm",
                "bg-white/80 dark:bg-gray-900/60",
                "border-gray-300 dark:border-gray-700",
                "focus:ring-2 focus:ring-indigo-500 focus:border-transparent",
                "resize-none custom-scrollbar"
              )}
              placeholder="Paste your mock test here..."
              spellCheck={false}
            />
            {raw && (
              <Badge
                variant="info"
                className="absolute top-4 right-4"
              >
                {raw.length} characters
              </Badge>
            )}
          </div>
          
          {parseErrors.length > 0 && (
            <div className="mt-4 space-y-2">
              {parseErrors.map((error, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-start gap-2 p-3 rounded-lg",
                    error.type === 'error' 
                      ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
                      : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300"
                  )}
                >
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{error.message}</span>
                </div>
              ))}
            </div>
          )}
          
          <div className="mt-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
            <h4 className="font-medium text-sm mb-2">Format Guidelines</h4>
            <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
              <li>• Questions start with numbers: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">1.</code>, <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">2.</code>, etc.</li>
              <li>• Options start with letters: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">A)</code>, <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">B)</code>, etc.</li>
              <li>• Include section: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">Answer Key & Rationale</code></li>
              <li>• Format answers as: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">1. Answer: B, D. Rationale text...</code></li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Settings Section */}
      <Card animated glass>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <Settings className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <CardTitle>Exam Settings</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Time Limit (minutes)
              </label>
              <input
                type="number"
                min={5}
                max={360}
                value={settings.minutes}
                onChange={e => setSettings({ ...settings, minutes: Number(e.target.value) })}
                className={cn(
                  "mt-1 w-full rounded-lg border p-2.5",
                  "bg-white/80 dark:bg-gray-900/60",
                  "border-gray-300 dark:border-gray-700",
                  "focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                )}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Pass Mark (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={settings.passMark}
                onChange={e => setSettings({ ...settings, passMark: Number(e.target.value) })}
                className={cn(
                  "mt-1 w-full rounded-lg border p-2.5",
                  "bg-white/80 dark:bg-gray-900/60",
                  "border-gray-300 dark:border-gray-700",
                  "focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                )}
              />
            </div>

            <div className="space-y-3">
              <Toggle
                checked={settings.shuffleQuestions}
                onChange={(v) => setSettings({ ...settings, shuffleQuestions: v })}
                label="Shuffle Questions"
              />
              <Toggle
                checked={settings.shuffleChoices}
                onChange={(v) => setSettings({ ...settings, shuffleChoices: v })}
                label="Shuffle Choices"
              />
            </div>
          </div>

          <div className="mt-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
            >
              {showAdvancedSettings ? 'Hide' : 'Show'} Advanced Settings
            </Button>
          </div>

          {showAdvancedSettings && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-4 grid sm:grid-cols-2 gap-4 overflow-hidden"
            >
              <Toggle
                checked={settings.showRationalesOnReviewOnly}
                onChange={(v) => setSettings({ ...settings, showRationalesOnReviewOnly: v })}
                label="Rationales Only on Review"
              />
              <Toggle
                checked={settings.enableQuestionNavigation}
                onChange={(v) => setSettings({ ...settings, enableQuestionNavigation: v })}
                label="Enable Question Navigation"
              />
              <Toggle
                checked={settings.enableFlagForReview}
                onChange={(v) => setSettings({ ...settings, enableFlagForReview: v })}
                label="Enable Flag for Review"
              />
              <Toggle
                checked={settings.autoSaveProgress}
                onChange={(v) => setSettings({ ...settings, autoSaveProgress: v })}
                label="Auto-save Progress"
              />
              <Toggle
                checked={settings.showTimer}
                onChange={(v) => setSettings({ ...settings, showTimer: v })}
                label="Show Timer"
              />
              <Toggle
                checked={settings.warnOnTimeRunningOut}
                onChange={(v) => setSettings({ ...settings, warnOnTimeRunningOut: v })}
                label="Time Warning"
              />
            </motion.div>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button
              onClick={onBuild}
              size="lg"
              className="shadow-lg"
              disabled={!raw.trim()}
            >
              <Play size={18} />
              Start Exam
            </Button>
            <Button
              onClick={handleParse}
              variant="secondary"
              disabled={!raw.trim()}
            >
              <ListChecks size={18} />
              Test Parse
            </Button>
            <Button
              onClick={onRunTests}
              variant="success"
            >
              <Beaker size={18} />
              Run Parser Tests
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Test Report */}
      {testReport && (
        <Card animated>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-4">
              {testReport.failed === 0 ? (
                <CheckCircle className="text-emerald-600" size={20} />
              ) : (
                <AlertCircle className="text-amber-600" size={20} />
              )}
              <span className="font-semibold">
                {testReport.passed} passed • {testReport.failed} failed
              </span>
            </div>
            <div className="space-y-2">
              {testReport.results.map((r: any, i: number) => (
                <div
                  key={i}
                  className={cn(
                    "p-2 rounded-lg text-sm",
                    r.error
                      ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
                      : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
                  )}
                >
                  <span className="font-medium">{r.name}</span>
                  {r.error && <div className="text-xs mt-1">{r.error}</div>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
};
