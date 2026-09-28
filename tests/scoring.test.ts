import { describe, it, expect } from 'vitest';
import { scoreSubmission } from '@/server/scoring';
import type { SubmittedAnswer } from '@/lib/types';

describe('scoreSubmission', () => {
  it('scores correctly answered questions', () => {
    const questions = [
      { id: 1, options: [{ id: 10, correct: true }, { id: 11, correct: false }] },
      { id: 2, options: [{ id: 20, correct: false }, { id: 21, correct: true }] },
    ];
    const answers: SubmittedAnswer[] = [
      { questionId: 1, optionId: 10 },
      { questionId: 2, optionId: 21 },
    ];
    const result = scoreSubmission(questions, answers);
    expect(result.score).toBe(2);
    expect(result.total).toBe(2);
    expect(result.percentage).toBe(100);
  });

  it('scores partially correct', () => {
    const questions = [
      { id: 1, options: [{ id: 10, correct: true }, { id: 11, correct: false }] },
      { id: 2, options: [{ id: 20, correct: false }, { id: 21, correct: true }] },
    ];
    const answers: SubmittedAnswer[] = [
      { questionId: 1, optionId: 10 },
      { questionId: 2, optionId: 20 },
    ];
    const result = scoreSubmission(questions, answers);
    expect(result.score).toBe(1);
    expect(result.total).toBe(2);
    expect(result.percentage).toBe(50);
  });

  it('scores unanswered as incorrect', () => {
    const questions = [
      { id: 1, options: [{ id: 10, correct: true }] },
      { id: 2, options: [{ id: 20, correct: true }] },
    ];
    const answers: SubmittedAnswer[] = [
      { questionId: 1, optionId: 10 },
      { questionId: 2, optionId: null },
    ];
    const result = scoreSubmission(questions, answers);
    expect(result.score).toBe(1);
    expect(result.percentage).toBe(50);
  });

  it('handles unknown option IDs as incorrect', () => {
    const questions = [
      { id: 1, options: [{ id: 10, correct: true }] },
    ];
    const answers: SubmittedAnswer[] = [
      { questionId: 1, optionId: 999 },
    ];
    const result = scoreSubmission(questions, answers);
    expect(result.score).toBe(0);
  });

  it('rounds percentage correctly', () => {
    const questions = [
      { id: 1, options: [{ id: 10, correct: true }] },
      { id: 2, options: [{ id: 20, correct: true }] },
      { id: 3, options: [{ id: 30, correct: true }] },
    ];
    const answers: SubmittedAnswer[] = [
      { questionId: 1, optionId: 10 },
      { questionId: 2, optionId: null },
      { questionId: 3, optionId: null },
    ];
    const result = scoreSubmission(questions, answers);
    expect(result.percentage).toBe(33);
  });

  it('returns detailed answer scoring', () => {
    const questions = [
      { id: 1, options: [{ id: 10, correct: true }, { id: 11, correct: false }] },
    ];
    const answers: SubmittedAnswer[] = [
      { questionId: 1, optionId: 10 },
    ];
    const result = scoreSubmission(questions, answers);
    expect(result.answers).toHaveLength(1);
    expect(result.answers[0]).toEqual({ questionId: 1, optionId: 10, isCorrect: true });
  });
});
