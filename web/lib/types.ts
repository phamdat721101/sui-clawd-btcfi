export type VibeMode = 'professional' | 'degen' | 'stoic' | 'pirate';

export interface Agent {
  id: string;
  user_id: string;
  name: string;
  vibe_mode: VibeMode;
  risk_tolerance: number;
  system_prompt: string | null;
  wallet_address: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  agent_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Pool {
  pool: string;
  symbol: string;
  project: string;
  chain: string;
  apy: number;
  tvlUsd: number;
  apyBase?: number;
  apyReward?: number;
}

export interface Database {
  public: {
    Tables: {
      agents: {
        Row: Agent;
        Insert: Omit<Agent, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Agent, 'id' | 'created_at' | 'updated_at'>>;
      };
      messages: {
        Row: Message;
        Insert: Omit<Message, 'id' | 'created_at'>;
        Update: Partial<Omit<Message, 'id' | 'created_at'>>;
      };
    };
  };
}
