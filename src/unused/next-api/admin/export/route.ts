import { NextResponse, NextRequest } from 'next/server';
import { listResults } from '@/server/results';
import { toCsv, formatDateTime } from '@/lib/csv';
import { jsonError, requireAdminRequest, serverError } from '@/server/http';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdminRequest(request);
  if (auth) return auth;

  try {
    const q = request.nextUrl.searchParams.get('q') ?? undefined;
    const results = await listResults({ query: q });

    const headers = ['�������', '���', 'Static ID', '������ ������', '�����', '% ���������', '����'];
    const rows = results.map((row) => [
      row.lastName,
      row.firstName,
      row.staticId,
      row.score,
      row.total,
      row.percentage,
      formatDateTime(row.createdAt),
    ]);

    const csv = toCsv(headers, rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="results-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}
