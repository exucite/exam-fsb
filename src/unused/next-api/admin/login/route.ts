import { NextResponse } from 'next/server';
import { verifyAdminPassword, createSessionToken } from '@/server/auth';
import { ADMIN_COOKIE_NAME, ADMIN_SESSION_TTL_SECONDS } from '@/lib/config';
import { jsonError, serverError } from '@/server/http';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<NextResponse<{ error: string } | { ok: boolean }>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('���� ������� ������ ���� ���������� JSON', 400);
  }

  const password = (body as Record<string, unknown>)?.password;
  if (typeof password !== 'string') {
    return jsonError('��������� ���� password', 400);
  }

  try {
    const isValid = await verifyAdminPassword(password);
    if (!isValid) {
      return jsonError('������ ��������', 401);
    }

    const token = await createSessionToken();
    const response = NextResponse.json({ ok: true });
    response.cookies.set(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: ADMIN_SESSION_TTL_SECONDS,
      path: '/',
    });
    return response;
  } catch (error) {
    // If ADMIN_PASSWORD is misconfigured, return 503 Service Unavailable.
    if (error instanceof Error && error.message.includes('ADMIN_PASSWORD')) {
      return jsonError('����� �� ��������', 503);
    }
    return serverError(error);
  }
}
