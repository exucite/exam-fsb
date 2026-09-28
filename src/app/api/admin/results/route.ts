import { NextResponse, NextRequest } from 'next/server';
import { listResults } from '@/server/results';
import { jsonError, requireAdminRequest, serverError } from '@/server/http';
import type { AdminResultRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse<{ results: AdminResultRow[] } | { error: string }>> {
  const auth = await requireAdminRequest(request);
  if (auth) return auth;

  try {
    const q = request.nextUrl.searchParams.get('q') ?? undefined;
    const sort = (request.nextUrl.searchParams.get('sort') ?? 'createdAt') as any;
    const results = await listResults({ query: q }, { field: sort, direction: 'desc' });
    return NextResponse.json({ results });
  } catch (error) {
    return serverError(error);
  }
}
