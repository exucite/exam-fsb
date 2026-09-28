import { NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME } from '@/lib/config';

export async function POST(): Promise<NextResponse<{ ok: boolean }>> {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(ADMIN_COOKIE_NAME);
  return response;
}
