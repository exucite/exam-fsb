import { NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME } from '@/lib/config';
import { verifySessionToken } from '@/server/auth';
import type { ApiError } from '@/lib/types';

export function jsonError(message: string, status: number): NextResponse<ApiError> {
  return NextResponse.json({ error: message }, { status });
}

export function serverError(error: unknown): NextResponse<ApiError> {
  // Intentionally generic: details go to the server log, never to the client.
  console.error('[api]', error instanceof Error ? error.message : 'unknown error');
  return jsonError('���������� ������ �������', 500);
}

export async function isAdminRequest(request: Request): Promise<boolean> {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const token = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ADMIN_COOKIE_NAME}=`))
    ?.slice(ADMIN_COOKIE_NAME.length + 1);

  return verifySessionToken(token ? decodeURIComponent(token) : undefined);
}

export function requireAdminRequest(request: Request): Promise<NextResponse<ApiError> | null> {
  return isAdminRequest(request).then((ok) => (ok ? null : jsonError('��������� �����������', 401)));
}
