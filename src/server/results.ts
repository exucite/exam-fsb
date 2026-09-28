import { prisma } from '@/lib/prisma';
import type { AdminResultRow } from '@/lib/types';

export interface ResultFilter {
  query?: string;
  from?: Date;
  to?: Date;
}

export type ResultSort = 'createdAt' | 'lastName' | 'percentage';

/** Admin-only query. Never exposed to participants. */
export async function listResults(
  filter: ResultFilter = {},
  sort: { field?: ResultSort; direction?: 'asc' | 'desc' } = {},
): Promise<AdminResultRow[]> {
  const where: Record<string, unknown> = {};
  const createdAt: Record<string, Date> = {};
  if (filter.from) createdAt.gte = filter.from;
  if (filter.to) createdAt.lte = filter.to;
  if (Object.keys(createdAt).length > 0) where.createdAt = createdAt;

  if (filter.query) {
    where.OR = [
      { firstName: { contains: filter.query } },
      { lastName: { contains: filter.query } },
      { staticId: { contains: filter.query } },
    ];
  }

  const field = sort.field ?? 'createdAt';
  const orderBy =
    field === 'createdAt'
      ? { createdAt: sort.direction ?? 'desc' }
      : field === 'percentage'
        ? { percentage: sort.direction ?? 'desc' }
        : { lastName: sort.direction ?? 'asc' };

  const attempts = await prisma.attempt.findMany({ where, orderBy, take: 1000 });

  return attempts.map((attempt) => ({
    attemptId: attempt.id,
    firstName: attempt.firstName,
    lastName: attempt.lastName,
    staticId: attempt.staticId,
    score: attempt.score,
    total: attempt.total,
    percentage: attempt.percentage,
    createdAt: attempt.createdAt.toISOString(),
  }));
}
