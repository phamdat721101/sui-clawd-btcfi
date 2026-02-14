'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else {
        setMessage('Check your email for a confirmation link.');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else {
        router.push('/dashboard');
      }
    }

    setLoading(false);
  }

  async function handleOAuth(provider: 'github' | 'google') {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-primary">OpenClaw</h1>
          <p className="mt-1 text-sm text-muted">Command Center</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-border bg-input px-4 py-3 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full rounded-lg border border-border bg-input px-4 py-3 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
          />

          {error && <p className="text-sm text-danger">{error}</p>}
          {message && <p className="text-sm text-accent">{message}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary py-3 text-sm font-medium text-foreground hover:bg-primary-hover disabled:opacity-50"
          >
            {loading ? '...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <div className="flex items-center gap-3 text-muted">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="space-y-2">
          <button
            onClick={() => handleOAuth('github')}
            className="w-full rounded-lg border border-border bg-card py-3 text-sm text-foreground hover:bg-card-hover"
          >
            Continue with GitHub
          </button>
          <button
            onClick={() => handleOAuth('google')}
            className="w-full rounded-lg border border-border bg-card py-3 text-sm text-foreground hover:bg-card-hover"
          >
            Continue with Google
          </button>
        </div>

        <p className="text-center text-xs text-muted">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(null); setMessage(null); }}
            className="text-primary hover:underline"
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  );
}
