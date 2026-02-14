'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useSearchParams, useRouter } from 'next/navigation';
import type { Agent, Message } from '@/lib/types';
import { cn } from '@/lib/utils';
import { StrategyCard } from '@/components/StrategyCard';

export default function ChatPage() {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();
  const agentId = searchParams.get('agent');

  // Load agent and messages
  useEffect(() => {
    if (!agentId) {
      router.push('/dashboard');
      return;
    }

    async function load() {
      const [{ data: agentData }, { data: messagesData }] = await Promise.all([
        supabase.from('agents').select('*').eq('id', agentId!).single(),
        supabase
          .from('messages')
          .select('*')
          .eq('agent_id', agentId!)
          .order('created_at', { ascending: true })
          .limit(100),
      ]);

      if (!agentData) {
        router.push('/dashboard');
        return;
      }

      setAgent(agentData);
      setMessages(messagesData || []);
    }

    load();
  }, [agentId, router, supabase]);

  // Subscribe to realtime messages
  useEffect(() => {
    if (!agentId) return;

    const channel = supabase
      .channel(`messages:${agentId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `agent_id=eq.${agentId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agentId, supabase]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !agent || sending) return;

    const content = input.trim();
    setInput('');
    setSending(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('messages').insert({
      agent_id: agent.id,
      user_id: user.id,
      role: 'user' as const,
      content,
      metadata: {},
    });

    setSending(false);
  }

  if (!agent) {
    return <p className="py-12 text-center text-muted">Loading...</p>;
  }

  return (
    <div className="flex h-[calc(100vh-57px)] flex-col">
      {/* Chat header */}
      <div className="border-b border-border px-4 py-3">
        <p className="font-medium">{agent.name}</p>
        <p className="text-xs text-muted capitalize">{agent.vibe_mode} mode · Risk {agent.risk_tolerance}/5</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted">Send a message to start chatting with your agent</p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              'flex',
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={cn(
                'max-w-[80%] rounded-lg px-4 py-3 text-sm whitespace-pre-wrap',
                msg.role === 'user'
                  ? 'bg-primary/20 text-foreground'
                  : 'bg-card border border-border text-foreground'
              )}
            >
              {msg.content}

              {/* Strategy cards for pool data */}
              {msg.metadata && typeof msg.metadata === 'object' && 'pools' in msg.metadata && Array.isArray((msg.metadata as Record<string, unknown>).pools) && (
                <div className="mt-3 space-y-2">
                  {((msg.metadata as Record<string, unknown>).pools as Array<Record<string, unknown>>).map((pool: Record<string, unknown>, i: number) => (
                    <StrategyCard key={i} pool={pool} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator when waiting for response */}
        {sending && (
          <div className="flex justify-start">
            <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted">
              Thinking...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="border-t border-border p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about yields, wallets, strategies..."
            className="flex-1 rounded-lg border border-border bg-input px-4 py-3 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-foreground hover:bg-primary-hover disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
