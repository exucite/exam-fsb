import type { SubmittedAnswer } from '@/lib/types';

export interface ScoredAnswer {
  questionId: number;
  optionId: number | null;
  isCorrect: boolean;
}

export interface ScoreResult {
  score: number;
  total: number;
  percentage: number;
  answers: ScoredAnswer[];
}

/** Options as stored in the DB, including the `correct` flag (server-only). */
export interface GradableOption {
  id: number;
  correct: boolean;
}

export interface GradableQuestion {
  id: number;
  options: GradableOption[];
}

/**
 * Grades a submission strictly from the database truth. Missing questions,
 * unknown question/option IDs and unanswered questions all count as wrong.
 */
export function scoreSubmission(
  questions: readonly GradableQuestion[],
  answers: readonly SubmittedAnswer[],
): ScoreResult {
  const byQuestion = new Map(questions.map((q) => [q.id, q]));

  const scored: ScoredAnswer[] = questions.map((q) => {
    const answer = answers.find((a) => a.questionId === q.id);
    if (!answer) return { questionId: q.id, optionId: null, isCorrect: false };

    const option = q.options.find((o) => o.id === answer.optionId);
    const isCorrect = option !== undefined && option.correct;
    return { questionId: q.id, optionId: option ? option.id : null, isCorrect };
  });

  const score = scored.filter((s) => s.isCorrect).length;
  const total = questions.length;
  const percentage = total === 0 ? 0 : Math.round((score / total) * 100);

  return { score, total, percentage, answers: scored };
}
