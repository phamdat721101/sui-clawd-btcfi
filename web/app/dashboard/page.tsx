'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import type { Agent } from '@/lib/types';
import { cn } from '@/lib/utils';

const VIBE_EMOJI: Record<string, string> = {
  professional: '📊',
  degen: '🦍',
  stoic: '🏛️',
  pirate: '🏴‍☠️',
};

export default function DashboardPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
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
    return <p className="py-12 text-center text-muted">Loading agents...</p>;
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
    <div className="space-y-6 py-6">
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
          <button
            key={agent.id}
            onClick={() => router.push(`/dashboard/chat?agent=${agent.id}`)}
            className={cn(
              'rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-card-hover'
            )}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{VIBE_EMOJI[agent.vibe_mode] || '🦞'}</span>
              <div>
                <p className="font-medium">{agent.name}</p>
                <p className="text-xs text-muted capitalize">{agent.vibe_mode} mode</p>
              </div>
            </div>
            <div className="mt-3 flex gap-4 text-xs text-muted">
              <span>Risk: {agent.risk_tolerance}/5</span>
              {agent.wallet_address && (
                <span>Wallet: {agent.wallet_address.slice(0, 8)}...</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
