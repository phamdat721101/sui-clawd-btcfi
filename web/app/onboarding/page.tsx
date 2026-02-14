'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { VibeMode } from '@/lib/types';

const VIBES: { mode: VibeMode; label: string; desc: string; emoji: string }[] = [
  { mode: 'professional', label: 'Professional', desc: 'Clear, data-driven analysis', emoji: '📊' },
  { mode: 'degen', label: 'Degen', desc: 'Ape-first, ask questions later', emoji: '🦍' },
  { mode: 'stoic', label: 'Stoic', desc: 'Calm wisdom, capital preservation', emoji: '🏛️' },
  { mode: 'pirate', label: 'Pirate', desc: 'Sail the seas for BTC treasure', emoji: '🏴‍☠️' },
];

export default function OnboardingPage() {
  const [name, setName] = useState('');
  const [vibe, setVibe] = useState<VibeMode>('professional');
  const [risk, setRisk] = useState(3);
  const [wallet, setWallet] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { error: insertError } = await supabase.from('agents').insert({
      user_id: user.id,
      name: name || 'OpenClawd',
      vibe_mode: vibe,
      risk_tolerance: risk,
      wallet_address: wallet || null,
      system_prompt: null,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
    } else {
      router.push('/dashboard');
    }
  }

  const riskLabels = ['Very Conservative', 'Conservative', 'Moderate', 'Aggressive', 'Very Aggressive'];

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-primary">Soul Forge</h1>
          <p className="mt-1 text-sm text-muted">Configure your AI sentinel</p>
        </div>

        <form onSubmit={handleCreate} className="space-y-6">
          {/* Agent Name */}
          <div className="space-y-2">
            <label className="text-sm text-muted">Agent Name</label>
            <input
              type="text"
              placeholder="OpenClawd"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-border bg-input px-4 py-3 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>

          {/* Vibe Mode */}
          <div className="space-y-2">
            <label className="text-sm text-muted">Vibe Mode</label>
            <div className="grid grid-cols-2 gap-2">
              {VIBES.map((v) => (
                <button
                  key={v.mode}
                  type="button"
                  onClick={() => setVibe(v.mode)}
                  className={cn(
                    'rounded-lg border p-3 text-left text-sm transition-colors',
                    vibe === v.mode
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-card text-muted hover:bg-card-hover'
                  )}
                >
                  <span className="text-lg">{v.emoji}</span>
                  <p className="mt-1 font-medium text-foreground">{v.label}</p>
                  <p className="text-xs text-muted">{v.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Risk Tolerance */}
          <div className="space-y-2">
            <label className="text-sm text-muted">
              Risk Tolerance: <span className="text-foreground">{riskLabels[risk - 1]}</span>
            </label>
            <input
              type="range"
              min={1}
              max={5}
              value={risk}
              onChange={(e) => setRisk(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted">
              <span>Safe</span>
              <span>Risky</span>
            </div>
          </div>

          {/* Wallet Address */}
          <div className="space-y-2">
            <label className="text-sm text-muted">Sui Wallet Address (optional)</label>
            <input
              type="text"
              placeholder="0x..."
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              className="w-full rounded-lg border border-border bg-input px-4 py-3 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary py-3 text-sm font-medium text-foreground hover:bg-primary-hover disabled:opacity-50"
          >
            {loading ? 'Forging...' : 'Forge Agent'}
          </button>
        </form>
      </div>
    </div>
  );
}
