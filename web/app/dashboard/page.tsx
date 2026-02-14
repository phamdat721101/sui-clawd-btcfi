'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import type { Agent, VibeMode, Pool } from '@/lib/types';
import type { BtcBalance } from '@/lib/sui';
import { VIBES, RISK_LABELS } from '@/lib/types';
import { StrategyCard } from '@/components/StrategyCard';
import { cn } from '@/lib/utils';

const VIBE_EMOJI: Record<string, string> = {
  professional: '📊',
  degen: '🦍',
  stoic: '🏛️',
  pirate: '🏴‍☠️',
};

type Tab = 'agents' | 'yields' | 'wallet';

export default function DashboardPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('agents');
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('agents')
        .select('*')
        .order('created_at', { ascending: false });
      setAgents(data || []);
      setLoading(false);
    }
    load();
  }, [supabase]);

  if (loading) {
    return <p className="py-12 text-center text-muted">Loading...</p>;
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'agents', label: 'Agents' },
    { key: 'yields', label: 'Yields' },
    { key: 'wallet', label: 'Wallet' },
  ];

  return (
    <div className="space-y-6 py-6">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              tab === t.key
                ? 'bg-primary text-foreground'
                : 'text-muted hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'agents' && <AgentsTab agents={agents} setAgents={setAgents} />}
      {tab === 'yields' && <YieldsTab />}
      {tab === 'wallet' && <WalletTab agents={agents} />}
    </div>
  );
}

/* ─── AGENTS TAB ─── */

function AgentsTab({
  agents,
  setAgents,
}: {
  agents: Agent[];
  setAgents: React.Dispatch<React.SetStateAction<Agent[]>>;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [editing, setEditing] = useState<Agent | null>(null);

  async function handleSave(updated: Partial<Agent> & { id: string }) {
    const { id, ...fields } = updated;
    const { error } = await supabase
      .from('agents')
      .update(fields)
      .eq('id', id);
    if (!error) {
      setAgents((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...fields } : a))
      );
      setEditing(null);
    }
  }

  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-lg text-muted">No agents yet</p>
        <p className="mt-1 text-sm text-muted">Create your first AI sentinel</p>
        <button
          onClick={() => router.push('/onboarding')}
          className="mt-4 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-foreground hover:bg-primary-hover"
        >
          Forge Agent
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Your Agents</h1>
        <button
          onClick={() => router.push('/onboarding')}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-foreground hover:bg-primary-hover"
        >
          + New Agent
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="rounded-lg border border-border bg-card p-4 text-left"
          >
            <button
              onClick={() => router.push(`/dashboard/chat?agent=${agent.id}`)}
              className="w-full text-left transition-colors hover:opacity-80"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">
                  {VIBE_EMOJI[agent.vibe_mode] || '🦞'}
                </span>
                <div>
                  <p className="font-medium">{agent.name}</p>
                  <p className="text-xs text-muted capitalize">
                    {agent.vibe_mode} mode
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-4 text-xs text-muted">
                <span>Risk: {agent.risk_tolerance}/5</span>
                {agent.wallet_address && (
                  <span>Wallet: {agent.wallet_address.slice(0, 8)}...</span>
                )}
              </div>
            </button>
            <button
              onClick={() => setEditing(agent)}
              className="mt-2 w-full rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:bg-card-hover"
            >
              Edit
            </button>
          </div>
        ))}
      </div>

      {/* Edit modal */}
      {editing && (
        <EditAgentModal
          agent={editing}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </>
  );
}

function EditAgentModal({
  agent,
  onClose,
  onSave,
}: {
  agent: Agent;
  onClose: () => void;
  onSave: (updated: Partial<Agent> & { id: string }) => void;
}) {
  const [name, setName] = useState(agent.name);
  const [vibe, setVibe] = useState<VibeMode>(agent.vibe_mode);
  const [risk, setRisk] = useState(agent.risk_tolerance);
  const [wallet, setWallet] = useState(agent.wallet_address || '');
  const [saving, setSaving] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md space-y-4 rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-bold">Edit Agent</h2>

        <div className="space-y-2">
          <label className="text-sm text-muted">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-border bg-input px-4 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-muted">Vibe Mode</label>
          <div className="grid grid-cols-2 gap-2">
            {VIBES.map((v) => (
              <button
                key={v.mode}
                type="button"
                onClick={() => setVibe(v.mode)}
                className={cn(
                  'rounded-lg border p-2 text-left text-xs transition-colors',
                  vibe === v.mode
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border bg-card text-muted hover:bg-card-hover'
                )}
              >
                <span>{v.emoji}</span> <span className="font-medium">{v.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-muted">
            Risk: <span className="text-foreground">{RISK_LABELS[risk - 1]}</span>
          </label>
          <input
            type="range"
            min={1}
            max={5}
            value={risk}
            onChange={(e) => setRisk(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-muted">Wallet Address</label>
          <input
            type="text"
            placeholder="0x..."
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            className="w-full rounded-lg border border-border bg-input px-4 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border py-2 text-sm text-muted hover:bg-card-hover"
          >
            Cancel
          </button>
          <button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              await onSave({
                id: agent.id,
                name: name || 'OpenClawd',
                vibe_mode: vibe,
                risk_tolerance: risk,
                wallet_address: wallet || null,
              });
              setSaving(false);
            }}
            className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-foreground hover:bg-primary-hover disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── YIELDS TAB ─── */

function YieldsTab() {
  const [pools, setPools] = useState<Pool[]>([]);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/yields');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setPools(json.pools || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAnalyze() {
    setAnalyzing(true);
    try {
      const res = await fetch('/api/yields?analyze=true');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setPools(json.pools || []);
      setAnalysis(json.analysis || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">BTC Yield Pools on Sui</h1>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="rounded-lg border border-border px-3 py-2 text-xs text-muted hover:bg-card-hover disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-foreground hover:bg-primary-hover disabled:opacity-50"
          >
            {analyzing ? 'Analyzing...' : 'Analyze with AI'}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {analysis && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 text-sm font-bold text-primary">Mission Brief</h2>
          <div className="whitespace-pre-wrap text-sm text-foreground">
            {analysis}
          </div>
        </div>
      )}

      {loading && pools.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">Loading pools...</p>
      ) : pools.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">No BTC pools found</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {pools.map((pool) => (
            <StrategyCard key={pool.pool} pool={pool} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── WALLET TAB ─── */

function WalletTab({ agents }: { agents: Agent[] }) {
  const wallets = agents.filter((a) => a.wallet_address);
  const [selectedAddress, setSelectedAddress] = useState<string>(
    wallets[0]?.wallet_address || ''
  );
  const [balances, setBalances] = useState<BtcBalance[]>([]);
  const [audit, setAudit] = useState<string | null>(null);
  const [loadingPos, setLoadingPos] = useState(false);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPositions = useCallback(async (address: string) => {
    if (!address) return;
    setLoadingPos(true);
    setError(null);
    setAudit(null);
    try {
      const res = await fetch(`/api/positions?address=${address}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setBalances(json.balances || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load positions');
    } finally {
      setLoadingPos(false);
    }
  }, []);

  useEffect(() => {
    if (selectedAddress) loadPositions(selectedAddress);
  }, [selectedAddress, loadPositions]);

  async function handleAudit() {
    if (!selectedAddress) return;
    setLoadingAudit(true);
    setError(null);
    try {
      const res = await fetch(`/api/audit?address=${selectedAddress}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setAudit(json.audit || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Audit failed');
    } finally {
      setLoadingAudit(false);
    }
  }

  if (wallets.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted">No wallets linked</p>
        <p className="mt-1 text-sm text-muted">
          Edit an agent to add a Sui wallet address first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Wallet Positions</h1>
        <button
          onClick={handleAudit}
          disabled={loadingAudit || !selectedAddress}
          className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-foreground hover:bg-primary-hover disabled:opacity-50"
        >
          {loadingAudit ? 'Auditing...' : 'Run Audit'}
        </button>
      </div>

      {/* Wallet selector */}
      {wallets.length > 1 && (
        <select
          value={selectedAddress}
          onChange={(e) => setSelectedAddress(e.target.value)}
          className="w-full rounded-lg border border-border bg-input px-4 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
        >
          {wallets.map((a) => (
            <option key={a.id} value={a.wallet_address!}>
              {a.name} — {a.wallet_address!.slice(0, 10)}...
              {a.wallet_address!.slice(-4)}
            </option>
          ))}
        </select>
      )}

      {wallets.length === 1 && (
        <p className="text-xs text-muted">
          {wallets[0].name} — {selectedAddress.slice(0, 10)}...
          {selectedAddress.slice(-4)}
        </p>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      {/* Positions */}
      {loadingPos ? (
        <p className="py-8 text-center text-sm text-muted">Loading positions...</p>
      ) : balances.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">
          No BTC holdings found for this wallet
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {balances.map((b) => (
            <div
              key={b.coinType}
              className="rounded-lg border border-border bg-card p-3"
            >
              <p className="text-sm font-medium text-foreground">{b.symbol}</p>
              <p className="mt-1 text-lg font-bold text-accent">{b.formatted}</p>
              <p className="mt-1 truncate text-xs text-muted">{b.coinType}</p>
            </div>
          ))}
        </div>
      )}

      {/* Audit result */}
      {audit && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 text-sm font-bold text-primary">Wallet Audit</h2>
          <div className="whitespace-pre-wrap text-sm text-foreground">
            {audit}
          </div>
        </div>
      )}
    </div>
  );
}
