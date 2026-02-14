import { NextResponse } from 'next/server';
import { fetchPools, getBtcBalances, auditWallet } from '@/lib/sui';

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
    const [balances, pools] = await Promise.all([
      getBtcBalances(address),
      fetchPools(),
    ]);

    const audit = await auditWallet(balances, pools);
    return NextResponse.json({ address, balances, audit });
  } catch (err) {
    console.error('GET /api/audit error:', err);
    return NextResponse.json(
      { error: 'Failed to generate audit' },
      { status: 500 }
    );
  }
}
