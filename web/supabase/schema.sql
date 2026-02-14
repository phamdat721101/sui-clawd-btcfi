-- OpenClaw Command Center — Supabase Schema
-- Run this in the Supabase SQL Editor

-- Enable realtime
create extension if not exists "uuid-ossp";

-- Agents table: each user's AI configuration
create table agents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null default 'OpenClawd',
  vibe_mode text not null default 'professional' check (vibe_mode in ('professional', 'degen', 'stoic', 'pirate')),
  risk_tolerance integer not null default 3 check (risk_tolerance between 1 and 5),
  system_prompt text,
  wallet_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Messages table: chat history with realtime
create table messages (
  id uuid primary key default uuid_generate_v4(),
  agent_id uuid references agents(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Indexes
create index idx_messages_agent_id on messages(agent_id);
create index idx_messages_created_at on messages(created_at);
create index idx_agents_user_id on agents(user_id);

-- RLS policies
alter table agents enable row level security;
alter table messages enable row level security;

-- Agents: users can only access their own agents
create policy "Users can view own agents"
  on agents for select
  using (auth.uid() = user_id);

create policy "Users can create own agents"
  on agents for insert
  with check (auth.uid() = user_id);

create policy "Users can update own agents"
  on agents for update
  using (auth.uid() = user_id);

create policy "Users can delete own agents"
  on agents for delete
  using (auth.uid() = user_id);

-- Messages: users can only access their own messages
create policy "Users can view own messages"
  on messages for select
  using (auth.uid() = user_id);

create policy "Users can insert own messages"
  on messages for insert
  with check (auth.uid() = user_id);

-- Service role can insert assistant messages (bridge process)
-- The bridge uses the service_role key which bypasses RLS

-- Enable realtime on messages table
alter publication supabase_realtime add table messages;

-- Updated_at trigger for agents
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger agents_updated_at
  before update on agents
  for each row
  execute function update_updated_at();
