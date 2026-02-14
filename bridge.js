require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { buildSystemPrompt } = require('./services/VibePrompts');
const config = require('./config');

// Validate bridge-specific env vars
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const genAI = new GoogleGenerativeAI(config.geminiApiKey);

const GEMINI_TIMEOUT = 30000;
const FUNCTION_CALL_TIMEOUT = 60000;
const MAX_FUNCTION_CALLS = 3;

// Agent sessions cache: agentId -> { model, chat, lastUsed }
const sessions = new Map();
const SESSION_TTL = 30 * 60 * 1000;

// Tool declarations (same as GeminiService)
const toolDeclarations = [
    {
        name: 'fetch_yield_pools',
        description: 'Fetch current real-time BTC yield pools on Sui from DefiLlama. Returns pool name, protocol, APY, TVL, and more.',
        parameters: { type: 'OBJECT', properties: {}, required: [] },
    },
    {
        name: 'get_wallet_btc_positions',
        description: "Get a Sui wallet's current BTC token balances from on-chain data.",
        parameters: {
            type: 'OBJECT',
            properties: {
                address: { type: 'STRING', description: 'The Sui wallet address (0x...)' },
            },
            required: ['address'],
        },
    },
];

async function executeFunctionCall(name, args) {
    switch (name) {
        case 'fetch_yield_pools': {
            const suiScanner = require('./services/SuiScanner');
            const pools = await suiScanner.fetchPools();
            return { pools: pools.slice(0, 15) };
        }
        case 'get_wallet_btc_positions': {
            const suiClient = require('./services/SuiClient');
            const balances = await suiClient.getBtcBalances(args.address);
            return { address: args.address, balances };
        }
        default:
            return { error: `Unknown function: ${name}` };
    }
}

async function handleFunctionCallingLoop(chat, result) {
    for (let i = 0; i < MAX_FUNCTION_CALLS; i++) {
        const response = result.response;
        if (!response?.candidates?.length) return result;

        const candidate = response.candidates[0];
        if (!candidate.content?.parts) return result;

        const functionCallPart = candidate.content.parts.find(p => p.functionCall);
        if (!functionCallPart) return result;

        const { name, args } = functionCallPart.functionCall;
        console.log(`[bridge] Function call: ${name}(${JSON.stringify(args)})`);

        let fnResult;
        try {
            fnResult = await executeFunctionCall(name, args || {});
        } catch (err) {
            console.error(`[bridge] Function ${name} failed:`, err.message);
            fnResult = { error: `Failed to execute ${name}: ${err.message}` };
        }

        result = await chat.sendMessage([{
            functionResponse: { name, response: fnResult },
        }], { signal: AbortSignal.timeout(FUNCTION_CALL_TIMEOUT) });
    }
    return result;
}

function getOrCreateSession(agentId, agent) {
    const existing = sessions.get(agentId);
    if (existing) {
        existing.lastUsed = Date.now();
        return existing.chat;
    }

    const systemInstruction = buildSystemPrompt(agent);
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        systemInstruction,
        tools: [{ functionDeclarations: toolDeclarations }],
    });

    const chat = model.startChat();
    sessions.set(agentId, { chat, lastUsed: Date.now() });
    return chat;
}

function pruneSessions() {
    const now = Date.now();
    for (const [key, entry] of sessions) {
        if (now - entry.lastUsed > SESSION_TTL) {
            sessions.delete(key);
        }
    }
}

async function fetchAgent(agentId) {
    const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('id', agentId)
        .single();

    if (error) throw new Error(`Failed to fetch agent: ${error.message}`);
    return data;
}

async function fetchRecentHistory(agentId, limit = 20) {
    const { data } = await supabase
        .from('messages')
        .select('role, content')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: true })
        .limit(limit);

    return data || [];
}

async function processMessage(payload) {
    const message = payload.new;

    // Only process user messages
    if (message.role !== 'user') return;

    console.log(`[bridge] Processing message ${message.id} for agent ${message.agent_id}`);

    try {
        const agent = await fetchAgent(message.agent_id);
        const chat = getOrCreateSession(message.agent_id, agent);

        let result = await chat.sendMessage(message.content, {
            signal: AbortSignal.timeout(GEMINI_TIMEOUT),
        });
        result = await handleFunctionCallingLoop(chat, result);

        const response = result.response;
        let text = null;

        try {
            text = response?.text();
        } catch (err) {
            console.error('[bridge] Failed to extract text:', err.message);
        }

        if (!text || text.trim().length === 0) {
            text = "I couldn't generate a response. Please try again. 🦞";
        }

        // Build metadata with strategy cards if pool data was fetched
        const metadata = {};
        // Check if function calls returned pool data
        const candidates = response?.candidates;
        if (candidates?.[0]?.content?.parts) {
            for (const part of candidates[0].content.parts) {
                if (part.functionResponse?.response?.pools) {
                    metadata.pools = part.functionResponse.response.pools.slice(0, 5);
                }
            }
        }

        // Insert assistant response
        const { error } = await supabase.from('messages').insert({
            agent_id: message.agent_id,
            user_id: message.user_id,
            role: 'assistant',
            content: text,
            metadata,
        });

        if (error) {
            console.error('[bridge] Failed to insert response:', error.message);
        } else {
            console.log(`[bridge] Response sent for message ${message.id}`);
        }
    } catch (err) {
        console.error('[bridge] Error processing message:', err.message);
        sessions.delete(message.agent_id);

        // Insert error response so the user isn't left hanging
        await supabase.from('messages').insert({
            agent_id: message.agent_id,
            user_id: message.user_id,
            role: 'assistant',
            content: 'My neural connection is unstable. Please try again later. 🦞',
            metadata: { error: true },
        });
    }
}

// Start the bridge
async function main() {
    console.log('[bridge] Supabase Bridge listening...');

    // Subscribe to new messages via realtime
    const channel = supabase
        .channel('messages-bridge')
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages' },
            processMessage
        )
        .subscribe((status) => {
            console.log(`[bridge] Realtime subscription: ${status}`);
        });

    // Prune sessions periodically
    const pruneTimer = setInterval(pruneSessions, 10 * 60 * 1000);

    // Graceful shutdown
    process.on('SIGTERM', () => {
        console.log('[bridge] Shutting down...');
        clearInterval(pruneTimer);
        supabase.removeChannel(channel);
        process.exit(0);
    });

    process.on('SIGINT', () => {
        console.log('[bridge] Shutting down...');
        clearInterval(pruneTimer);
        supabase.removeChannel(channel);
        process.exit(0);
    });
}

main().catch(err => {
    console.error('[bridge] Fatal error:', err);
    process.exit(1);
});
