import { cryptoRandom, shuffle } from '@/server/shuffle';
import { prisma } from '@/lib/prisma';
import type { PublicQuestion } from '@/lib/types';

export class NoQuestionsError extends Error {
  constructor() {
    super('����� �������� �� �����������');
    this.name = 'NoQuestionsError';
  }
}

/**
 * Loads the published question set. Question order is the stored order;
 * option order is shuffled independently for every request (every attempt).
 */
export async function getShuffledQuestions(): Promise<PublicQuestion[]> {
  const questions = await prisma.question.findMany({
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      text: true,
      options: { select: { id: true, text: true }, orderBy: { sortOrder: 'asc' } },
    },
  });

  if (questions.length === 0) throw new NoQuestionsError();

  const rand = cryptoRandom();
  return questions.map((question) => ({
    id: question.id,
    text: question.text,
    // `correct` is intentionally absent from the selection: it cannot leak.
    options: shuffle(question.options, rand),
  }));
}
