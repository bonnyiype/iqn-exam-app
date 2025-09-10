import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  CheckCircle, XCircle, Download, Save, RefreshCcw, Settings,
  ChevronDown, ChevronUp, Flag, TrendingUp, Clock, Award,
  FileText, BarChart
} from 'lucide-react';
import { Button, Card, CardHeader, CardTitle, CardContent, Badge, Progress } from '../ui';
import { ExamData, ResultSummary, ChoiceKey } from '../../types';
import { cn, toCSV, exportExamJSON, formatTimeSpent } from '../../utils/helpers';

interface ReviewViewProps {
  exam: ExamData;
  answers: Record<number, ChoiceKey[]>;
  flaggedQuestions: number[];
  summary: ResultSummary;
  onRestart: () => void;
  onRetake: () => void;
}

export const ReviewView: React.FC<ReviewViewProps> = ({
  exam,
  answers,
  flaggedQuestions,
  summary,
  onRestart,
  onRetake
}) => {
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());
  const [filterType, setFilterType] = useState<'all' | 'correct' | 'incorrect' | 'flagged'>('all');

  const toggleExpanded = (questionId: number) => {
    const newExpanded = new Set(expandedQuestions);
    if (newExpanded.has(questionId)) {
      newExpanded.delete(questionId);
    } else {
      newExpanded.add(questionId);
    }
    setExpandedQuestions(newExpanded);
  };

  const filteredQuestions = exam.questions.filter(q => {
    const picked = (answers[q.id] || []).sort();
    const correct = q.correct.slice().sort();
    const isCorrect = picked.length === correct.length && 
                     picked.every((v, idx) => v === correct[idx]);
    
    switch (filterType) {
      case 'correct': return isCorrect;
      case 'incorrect': return !isCorrect;
      case 'flagged': return flaggedQuestions.includes(q.id);
      default: return true;
    }
  });

  const handleExport = (format: 'csv' | 'json', includeAnswers: boolean = true) => {
    if (format === 'csv') {
      const csv = toCSV(exam, answers);
      const filename = `iqn_results_${new Date().toISOString().split('T')[0]}.csv`;
      downloadFile(filename, csv);
    } else {
      const json = exportExamJSON(exam, includeAnswers);
      const filename = `iqn_exam_${new Date().toISOString().split('T')[0]}.json`;
      downloadFile(filename, json);
    }
  };

  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Summary Card */}
      <Card animated glass>
        <CardContent className="p-8">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
            {/* Score Section */}
            <div className="flex items-center gap-6">
              <div className={cn(
                "p-4 rounded-full",
                summary.passed 
                  ? "bg-emerald-100 dark:bg-emerald-900/30" 
                  : "bg-red-100 dark:bg-red-900/30"
              )}>
                {summary.passed ? (
                  <CheckCircle className="w-12 h-12 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <XCircle className="w-12 h-12 text-red-600 dark:text-red-400" />
                )}
              </div>
              
              <div>
                <h2 className="text-3xl font-bold mb-1">
                  {summary.passed ? 'Congratulations!' : 'Keep Practicing!'}
                </h2>
                <div className="flex items-center gap-4">
                  <Badge 
                    variant={summary.passed ? 'success' : 'error'} 
                    size="lg"
                    className="text-lg px-4 py-2"
                  >
                    {summary.scorePct}%
                  </Badge>
                  <span className="text-gray-600 dark:text-gray-400">
                    {summary.correctCount} / {summary.total} correct
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleExport('csv')}
              >
                <Download size={16} />
                Export CSV
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleExport('json')}
              >
                <Save size={16} />
                Save Exam
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={onRetake}
              >
                <RefreshCcw size={16} />
                Retake
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onRestart}
              >
                <Settings size={16} />
                New Exam
              </Button>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-4 h-4 text-indigo-600" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Pass Mark</span>
              </div>
              <p className="text-2xl font-semibold">{summary.passed ? '✓' : '✗'} {summary.scorePct}%</p>
            </div>
            
            {summary.timeSpent && (
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Time Spent</span>
                </div>
                <p className="text-2xl font-semibold">{formatTimeSpent(summary.timeSpent)}</p>
              </div>
            )}
            
            {flaggedQuestions.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Flag className="w-4 h-4 text-amber-600" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Flagged</span>
                </div>
                <p className="text-2xl font-semibold">{flaggedQuestions.length}</p>
              </div>
            )}
            
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart className="w-4 h-4 text-purple-600" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Questions</span>
              </div>
              <p className="text-2xl font-semibold">{exam.questions.length}</p>
            </div>
          </div>

          {/* Category Breakdown */}
          {summary.categoryScores && Object.keys(summary.categoryScores).length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Performance by Category
              </h3>
              <div className="space-y-3">
                {Object.entries(summary.categoryScores).map(([category, score]) => (
                  <div key={category}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-600 dark:text-gray-400">{category}</span>
                      <span className="text-sm font-medium">{score}%</span>
                    </div>
                    <Progress 
                      value={score} 
                      variant={score >= 80 ? 'success' : score >= 60 ? 'warning' : 'error'}
                      size="sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Section */}
      <Card animated>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Detailed Review</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant={filterType === 'all' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setFilterType('all')}
              >
                All ({exam.questions.length})
              </Button>
              <Button
                variant={filterType === 'correct' ? 'success' : 'ghost'}
                size="sm"
                onClick={() => setFilterType('correct')}
              >
                Correct ({summary.correctCount})
              </Button>
              <Button
                variant={filterType === 'incorrect' ? 'danger' : 'ghost'}
                size="sm"
                onClick={() => setFilterType('incorrect')}
              >
                Incorrect ({summary.total - summary.correctCount})
              </Button>
              {flaggedQuestions.length > 0 && (
                <Button
                  variant={filterType === 'flagged' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setFilterType('flagged')}
                >
                  Flagged ({flaggedQuestions.length})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredQuestions.map((q, idx) => {
              const picked = (answers[q.id] || []).sort();
              const correct = q.correct.slice().sort();
              const isCorrect = picked.length === correct.length && 
                               picked.every((v, i) => v === correct[i]);
              const isExpanded = expandedQuestions.has(q.id);
              const isFlagged = flaggedQuestions.includes(q.id);

              return (
                <motion.div
                  key={q.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={cn(
                    "border rounded-xl overflow-hidden",
                    "bg-white dark:bg-gray-900/50",
                    isCorrect
                      ? "border-emerald-200 dark:border-emerald-800"
                      : "border-red-200 dark:border-red-800"
                  )}
                >
                  {/* Question Header */}
                  <div
                    className={cn(
                      "p-4 cursor-pointer",
                      isCorrect
                        ? "bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
                        : "bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30"
                    )}
                    onClick={() => toggleExpanded(q.id)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge variant="secondary" size="sm">
                            Q{q.id}
                          </Badge>
                          {q.multi && (
                            <Badge variant="info" size="sm">
                              Multi-Select
                            </Badge>
                          )}
                          {q.category && (
                            <Badge variant="default" size="sm">
                              {q.category}
                            </Badge>
                          )}
                          {isFlagged && (
                            <Badge variant="warning" size="sm">
                              <Flag size={12} />
                              Flagged
                            </Badge>
                          )}
                        </div>
                        <p className="text-gray-900 dark:text-gray-100 font-medium">
                          {q.text}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge 
                          variant={isCorrect ? 'success' : 'error'}
                          size="lg"
                        >
                          {isCorrect ? 'Correct' : 'Incorrect'}
                        </Badge>
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-gray-200 dark:border-gray-700"
                    >
                      <div className="p-4 space-y-4">
                        {/* Choices */}
                        <div className="space-y-2">
                          {q.choices.map(choice => {
                            const wasPicked = picked.includes(choice.key);
                            const isCorrectChoice = correct.includes(choice.key);
                            
                            return (
                              <div
                                key={choice.key}
                                className={cn(
                                  "p-3 rounded-lg border",
                                  isCorrectChoice && "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700",
                                  wasPicked && !isCorrectChoice && "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700",
                                  !wasPicked && !isCorrectChoice && "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700"
                                )}
                              >
                                <div className="flex items-start gap-3">
                                  <span className={cn(
                                    "font-semibold",
                                    isCorrectChoice && "text-emerald-700 dark:text-emerald-300",
                                    wasPicked && !isCorrectChoice && "text-red-700 dark:text-red-300"
                                  )}>
                                    {choice.key})
                                  </span>
                                  <span className="flex-1">{choice.text}</span>
                                  <div className="flex items-center gap-2">
                                    {isCorrectChoice && (
                                      <Badge variant="success" size="sm">
                                        <CheckCircle size={12} className="mr-1" />
                                        Correct
                                      </Badge>
                                    )}
                                    {wasPicked && !isCorrectChoice && (
                                      <Badge variant="error" size="sm">
                                        <XCircle size={12} className="mr-1" />
                                        Your Answer
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Rationale */}
                        {q.rationale && (
                          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                            <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">
                              Explanation
                            </h4>
                            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                              {q.rationale}
                            </p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
