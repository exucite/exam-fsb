import { NextResponse, NextRequest } from 'next/server';
import { sanitizeText, ValidationError } from '@/lib/validation';
import { LIMITS } from '@/lib/config';
import { resetCooldown } from '@/server/attempts';
import { jsonError, requireAdminRequest, serverError } from '@/server/http';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
): Promise<NextResponse<{ ok: true; staticId: string } | { error: string }>> {
  const auth = await requireAdminRequest(request);
  if (auth) return auth;

  try {
    const body: unknown = await request.json();
    const staticId =
      body && typeof body === 'object'
        ? sanitizeText((body as Record<string, unknown>).staticId, LIMITS.staticId)
        : '';

    if (!staticId) return jsonError('Укажите Static ID', 400);

    const ok = await resetCooldown(staticId);
    if (!ok) return jsonError('Попыток с таким Static ID не найдено — кулдауна нет', 404);

    return NextResponse.json({ ok: true, staticId });
  } catch (error) {
    if (error instanceof ValidationError) return jsonError(error.message, 400);
    return serverError(error);
  }
}
