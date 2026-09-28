import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jsonError, requireAdminRequest, serverError } from '@/server/http';

export const dynamic = 'force-dynamic';

export interface DailyStat {
  date: string;
  count: number;
  avgPercentage: number;
}

export interface AdminStats {
  todayCount: number;
  weekCount: number;
  monthCount: number;
  totalCount: number;
  uniqueParticipants: number;
  avgPercentage: number;
  last24h: DailyStat[];
}

function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse<AdminStats | { error: string }>> {
  const auth = await requireAdminRequest(request);
  if (auth) return auth;

  try {
    const now = new Date();

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 6);

    const startOfMonth = new Date(startOfToday);
    startOfMonth.setDate(startOfMonth.getDate() - 29);

    const startOf24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [todayCount, weekCount, monthCount, totalCount, uniqueGroup, avg, recent] =
      await Promise.all([
        prisma.attempt.count({ where: { submittedAt: { gte: startOfToday } } }),
        prisma.attempt.count({ where: { submittedAt: { gte: startOfWeek } } }),
        prisma.attempt.count({ where: { submittedAt: { gte: startOfMonth } } }),
        prisma.attempt.count(),
        prisma.attempt.groupBy({ by: ['staticId'], _count: { _all: true } }),
        prisma.attempt.aggregate({ _avg: { percentage: true } }),
        prisma.attempt.findMany({
          where: { submittedAt: { gte: startOf24h } },
          select: { submittedAt: true, percentage: true },
          orderBy: { submittedAt: 'asc' },
        }),
      ]);

    // Распределение по часам за последние 24 часа
    const hourBuckets = new Map<string, { count: number; sum: number }>();
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 60 * 60 * 1000);
      d.setMinutes(0, 0, 0);
      hourBuckets.set(dayKey(d) + ' ' + String(d.getHours()).padStart(2, '0'), { count: 0, sum: 0 });
    }
    for (const row of recent) {
      const d = row.submittedAt;
      const key = dayKey(d) + ' ' + String(d.getHours()).padStart(2, '0');
      const bucket = hourBuckets.get(key);
      if (bucket) {
        bucket.count += 1;
        bucket.sum += row.percentage;
      }
    }

    const last24h: DailyStat[] = Array.from(hourBuckets.entries()).map(([hour, v]) => ({
      date: hour,
      count: v.count,
      avgPercentage: v.count > 0 ? Math.round(v.sum / v.count) : 0,
    }));

    return NextResponse.json({
      todayCount,
      weekCount,
      monthCount,
      totalCount,
      uniqueParticipants: uniqueGroup.length,
      avgPercentage: Math.round(avg._avg.percentage ?? 0),
      last24h,
    });
  } catch (error) {
    return serverError(error);
  }
}
