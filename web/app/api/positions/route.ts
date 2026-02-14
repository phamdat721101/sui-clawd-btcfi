import { NextResponse } from 'next/server';
import { getBtcBalances } from '@/lib/sui';

const ADDRESS_RE = /^0x[a-fA-F0-9]{64}$/;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address || !ADDRESS_RE.test(address)) {
    return NextResponse.json(
      { error: 'Missing or invalid Sui address (expected 0x + 64 hex chars)' },
      { status: 400 }
    );
  }

  try {
    const balances = await getBtcBalances(address);
    return NextResponse.json({ address, balances });
  } catch (err) {
    console.error('GET /api/positions error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch positions' },
      { status: 500 }
    );
  }
}
