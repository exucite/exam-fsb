import { NextResponse } from 'next/server';
import { getShuffledQuestions, NoQuestionsError } from '@/server/questions';
import { getCooldownRemainingMs, formatRemaining } from '@/server/attempts';
import { getBrowserId } from '@/server/browser';
import { sanitizeText, ValidationError } from '@/lib/validation';
import { LIMITS } from '@/lib/config';
import { jsonError, serverError } from '@/server/http';
import type { PublicQuestion } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
): Promise<NextResponse<{ questions: PublicQuestion[] } | { error: string; retryAfterMs?: number }>> {
  try {
    // Access gate: a static ID + browser pair that is cooling down cannot even
    // load the questions, let alone submit. The submit endpoint re-checks on
    // its own, so this gate cannot be bypassed by racing the form.
    const rawStaticId = new URL(request.url).searchParams.get('staticId') ?? '';
    const staticId = sanitizeText(rawStaticId, LIMITS.staticId);
    if (!staticId) return jsonError('Не указан Static ID', 400);

    const browserId = await getBrowserId(true);
    const remaining = await getCooldownRemainingMs(staticId, browserId);
    if (remaining > 0) {
      // Milliseconds, not rounded minutes: the client counts down from the
      // exact server-provided deadline instead of a rounded-off minute value.
      return NextResponse.json(
        {
          error: `Тест уже пройден с этого браузера. Повторный доступ будет открыт через ${formatRemaining(remaining)}`,
          retryAfterMs: remaining,
        },
        { status: 403 },
      );
    }

    const questions = await getShuffledQuestions();
    return NextResponse.json({ questions });
  } catch (error) {
    if (error instanceof NoQuestionsError) {
      return jsonError(error.message, 409);
    }
    if (error instanceof ValidationError) {
      return jsonError(error.message, 400);
    }
    return serverError(error);
  }
}
