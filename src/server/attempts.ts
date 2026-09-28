import { prisma } from '@/lib/prisma';
import { ValidationError } from '@/lib/validation';
import { ATTEMPT_COOLDOWN_MS } from '@/lib/config';
import type { AttemptResult, SubmissionPayload } from '@/lib/types';
import { scoreSubmission } from '@/server/scoring';

export class SubmissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SubmissionError';
  }
}

/** Milliseconds left until the participant may attempt again. */
export async function getCooldownRemainingMs(
  staticId: string,
  browserId: string,
  nowMs: number = Date.now(),
): Promise<number> {
  const [last, lastReset] = await Promise.all([
    prisma.attempt.findFirst({
      where: { staticId, browserId },
      orderBy: { submittedAt: 'desc' },
      select: { submittedAt: true },
    }),
    // The most recent admin reset for this static ID, if any. Only the pair
    // (staticId, browserId) actually gets blocked, but a reset covers every
    // browser that was locked under this static ID.
    prisma.cooldownReset.findFirst({
      where: { staticId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);
  if (!last) return 0;

  // A reset newer than the last attempt lifts the cooldown entirely;
  // otherwise it counts from the attempt itself.
  if (lastReset && lastReset.createdAt > last.submittedAt) return 0;

  const elapsed = nowMs - last.submittedAt.getTime();
  return Math.max(0, ATTEMPT_COOLDOWN_MS - elapsed);
}

/** Admin action: lift the cooldown for every browser bound to this static ID. */
export async function resetCooldown(staticId: string): Promise<boolean> {
  const last = await prisma.attempt.findFirst({
    where: { staticId },
    orderBy: { submittedAt: 'desc' },
    select: { id: true },
  });
  if (!last) return false;

  await prisma.cooldownReset.create({ data: { staticId } });
  return true;
}

function formatRemaining(ms: number): string {
  const minutes = Math.ceil(ms / 60000);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest > 0 ? `${hours} ч ${rest} мин` : `${hours} ч`;
  }
  return `${minutes} мин`;
}

/**
 * Persists an attempt. Everything that determines the score is recomputed from
 * the database; client-supplied counts or percentages are never accepted.
 * Attempts are rate-limited: one submission per static ID + browser per hour.
 */
export async function saveSubmission(payload: SubmissionPayload): Promise<AttemptResult> {
  const questions = await prisma.question.findMany({
    select: { id: true, options: { select: { id: true, correct: true } } },
  });

  if (questions.length === 0) throw new SubmissionError('Вопросы не найдены в базе');

  const knownQuestionIds = new Set(questions.map((question) => question.id));
  const answeredQuestionIds = new Set<number>();

  for (const answer of payload.answers) {
    if (!knownQuestionIds.has(answer.questionId)) {
      throw new ValidationError('Ответ содержит неизвестный вопрос');
    }
    if (answeredQuestionIds.has(answer.questionId)) {
      throw new ValidationError('Один и тот же вопрос встречается в ответах дважды');
    }
    answeredQuestionIds.add(answer.questionId);
  }

  const result = scoreSubmission(questions, payload.answers);

  const attempt = await prisma.attempt.create({
    data: {
      firstName: payload.participant.firstName,
      lastName: payload.participant.lastName,
      staticId: payload.participant.staticId,
      browserId: payload.browserId,
      score: result.score,
      total: result.total,
      percentage: result.percentage,
      answers: {
        create: result.answers.map((answer) => ({
          questionId: answer.questionId,
          optionId: answer.optionId,
          isCorrect: answer.isCorrect,
        })),
      },
    },
    select: { id: true },
  });

  return { attemptId: attempt.id, score: result.score, total: result.total, percentage: result.percentage };
}

export { formatRemaining };
