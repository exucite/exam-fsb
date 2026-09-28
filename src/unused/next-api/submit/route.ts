import { NextResponse } from 'next/server';
import { parseSubmission, ValidationError } from '@/lib/validation';
import { saveSubmission, getCooldownRemainingMs, formatRemaining, SubmissionError } from '@/server/attempts';
import { getBrowserId } from '@/server/browser';
import { jsonError, serverError } from '@/server/http';
import type { AttemptResult } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
): Promise<NextResponse<AttemptResult | { error: string; retryAfterMs?: number }>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Тело запроса должно быть корректным JSON', 400);
  }

  try {
    const parsed = parseSubmission(body);
    const browserId = await getBrowserId(true);

    const remaining = await getCooldownRemainingMs(parsed.participant.staticId, browserId);
    if (remaining > 0) {
      return NextResponse.json(
        {
          error: `Следующая попытка будет доступна через ${formatRemaining(remaining)}`,
          retryAfterMs: remaining,
        },
        { status: 429 },
      );
    }

    const result = await saveSubmission({ ...parsed, browserId });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) return jsonError(error.message, 400);
    if (error instanceof SubmissionError) return jsonError(error.message, 409);
    return serverError(error);
  }
}
