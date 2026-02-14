import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Pool } from './types';

const SUI_RPC_URL = process.env.SUI_RPC_URL || 'https://fullnode.mainnet.sui.io:443';

const BTC_COIN_TYPES = ['::btc::', '::wbtc::', '::sbtc::', '::lbtc::', '::fbtc::', '::mbtc::', '::cbtc::'];

function getGeminiModel() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  return genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
}

export async function fetchPools(): Promise<Pool[]> {
  const res = await fetch('https://yields.llama.fi/pools', {
    signal: AbortSignal.timeout(15000),
    next: { revalidate: 300 },
  } as RequestInit);

  if (!res.ok) throw new Error(`DefiLlama returned ${res.status}`);

  const json = await res.json();
  if (!json?.data) throw new Error('Invalid data format from DefiLlama');

  const pools: Pool[] = json.data
    .filter(
      (p: Record<string, unknown>) =>
        p.chain === 'Sui' &&
        String(p.symbol).toUpperCase().includes('BTC') &&
        (p.tvlUsd as number) > 10000
    )
    .map((p: Record<string, unknown>) => ({
      pool: String(p.pool),
      symbol: String(p.symbol),
      project: String(p.project),
      chain: String(p.chain),
      apy: Number(p.apy),
      tvlUsd: Number(p.tvlUsd),
      apyBase: p.apyBase != null ? Number(p.apyBase) : undefined,
      apyReward: p.apyReward != null ? Number(p.apyReward) : undefined,
    }));

  pools.sort((a, b) => b.apy - a.apy);
  return pools;
}

export interface BtcBalance {
  coinType: string;
  totalBalance: string;
  symbol: string;
  formatted: string;
}

export async function getBtcBalances(address: string): Promise<BtcBalance[]> {
  const res = await fetch(SUI_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'suix_getAllBalances',
      params: [address],
    }),
    signal: AbortSignal.timeout(10000),
  });

  const json = await res.json();
  if (json.error) throw new Error(`Sui RPC: ${json.error.message}`);

  const allBalances: { coinType: string; totalBalance: string }[] = json.result || [];

  return allBalances
    .filter((b) => BTC_COIN_TYPES.some((t) => b.coinType.toLowerCase().includes(t)))
    .map((b) => {
      const parts = b.coinType.split('::');
      const symbol = parts[parts.length - 1]?.toUpperCase() || 'BTC';
      const raw = BigInt(b.totalBalance);
      const whole = raw / BigInt(10 ** 8);
      const frac = raw % BigInt(10 ** 8);
      const formatted = `${whole}.${frac.toString().padStart(8, '0').slice(0, 4)}`;
      return {
        coinType: b.coinType,
        totalBalance: b.totalBalance,
        symbol,
        formatted,
      };
    });
}

export async function analyzeYields(pools: Pool[]): Promise<string> {
  const model = getGeminiModel();

  const now = new Date().toLocaleDateString('en-GB', {
    timeZone: 'Asia/Bangkok',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const prompt = `You are OpenClawd Sentinel. Generate a "9 AM Mission Brief" for Sui BTCFi yields.

DATE: ${now} (GMT+7)

FORMAT the report EXACTLY like this:
- Header: "🦞 OPENCLAWD MISSION BRIEF — [date]"
- Section: "🎯 HIGH-YIELD MISSIONS" with the top 3 opportunities
- For EACH mission include:
  • Pool name and protocol
  • APY (percentage)
  • TVL (formatted in $M or $K)
  • Risk Score (1-5 scale): 1=Very Safe, 2=Safe, 3=Moderate, 4=Risky, 5=Very Risky
    Base this on TVL size (higher=safer), APY sustainability (extremely high APY=riskier), and protocol maturity
  • A simple ASCII strategy flow, e.g.: Wallet → Swap WBTC → Supply to Pool → Earn APY
- Section: "📡 MARKET SENTIMENT" — 2-3 sentence summary of the overall Sui BTC yield landscape
- Sign off with 🦞

Use **bold** for emphasis.

POOL DATA (JSON):
${JSON.stringify(pools.slice(0, 10))}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  return text || 'Failed to generate the Mission Brief. 🦞';
}

export async function auditWallet(
  balances: BtcBalance[],
  pools: Pool[]
): Promise<string> {
  const model = getGeminiModel();

  const prompt = `You are OpenClawd Sentinel. Generate a PERSONALIZED YIELD AUDIT for a Sui wallet.

USER'S CURRENT BTC HOLDINGS ON SUI:
${JSON.stringify(balances)}

TOP AVAILABLE BTC YIELD POOLS ON SUI:
${JSON.stringify(pools.slice(0, 10))}

FORMAT the audit as follows:
- Header: "🔍 OPENCLAWD WALLET AUDIT"
- Section: "💰 CURRENT HOLDINGS" — summarize what the user holds
- Section: "🎯 RECOMMENDED ACTIONS" — for each recommendation include:
  • The target pool/protocol
  • Expected APY
  • Risk Score (1-5): 1=Very Safe, 2=Safe, 3=Moderate, 4=Risky, 5=Very Risky
  • Strategy flow: e.g. Wallet → Swap → Supply → Earn
  • Why this is a good move (1 sentence)
- Section: "⚠️ RISKS" — brief risk summary
- Sign off with 🦞

Use **bold** for emphasis. Be actionable and concise.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  return text || 'Failed to generate your wallet audit. 🦞';
}
