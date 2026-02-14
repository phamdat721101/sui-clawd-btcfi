import { NextResponse } from 'next/server';
import { fetchPools, analyzeYields } from '@/lib/sui';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pools = await fetchPools();
    const analyze = searchParams.get('analyze') === 'true';

    if (analyze) {
      const analysis = await analyzeYields(pools);
      return NextResponse.json({ pools, analysis });
    }

    return NextResponse.json({ pools });
  } catch (err) {
    console.error('GET /api/yields error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch yield data' },
      { status: 500 }
    );
  }
}
