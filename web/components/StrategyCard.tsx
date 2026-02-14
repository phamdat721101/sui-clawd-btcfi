interface StrategyCardProps {
  pool: Record<string, unknown>;
}

export function StrategyCard({ pool }: StrategyCardProps) {
  const symbol = String(pool.symbol || 'Unknown');
  const project = String(pool.project || 'Unknown');
  const apy = typeof pool.apy === 'number' ? pool.apy.toFixed(2) : '—';
  const tvl = typeof pool.tvlUsd === 'number' ? formatTvl(pool.tvlUsd) : '—';

  return (
    <div className="rounded-lg border border-border bg-background p-3 text-xs">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-foreground">{symbol}</p>
          <p className="text-muted">{project}</p>
        </div>
        <div className="text-right">
          <p className="font-medium text-accent">{apy}% APY</p>
          <p className="text-muted">{tvl} TVL</p>
        </div>
      </div>
    </div>
  );
}

function formatTvl(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}
