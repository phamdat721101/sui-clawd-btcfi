'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/login');
      } else {
        setLoading(false);
      }
    });
  }, [router, supabase.auth]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <nav className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-lg font-bold text-primary">
              OpenClaw
            </Link>
            <div className="flex gap-4 text-sm">
              <Link
                href="/dashboard"
                className={cn(
                  'hover:text-foreground',
                  pathname === '/dashboard' ? 'text-foreground' : 'text-muted'
                )}
              >
                Agents
              </Link>
              <Link
                href="/dashboard/chat"
                className={cn(
                  'hover:text-foreground',
                  pathname === '/dashboard/chat' ? 'text-foreground' : 'text-muted'
                )}
              >
                Chat
              </Link>
            </div>
          </div>
          <button onClick={handleSignOut} className="text-sm text-muted hover:text-foreground">
            Sign Out
          </button>
        </div>
      </nav>
      <main className="mx-auto max-w-5xl p-4">{children}</main>
    </div>
  );
}
