const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('../config');

const SESSION_TTL = 30 * 60 * 1000; // 30 minutes
const PRUNE_INTERVAL = 10 * 60 * 1000; // 10 minutes
const GEMINI_TIMEOUT = 30000; // 30 seconds
const FUNCTION_CALL_TIMEOUT = 60000; // 60 seconds for function calling loops
const MAX_FUNCTION_CALLS = 3;
const TELEGRAM_MAX_LENGTH = 4096;

class GeminiService {
    constructor() {
        this.genAI = new GoogleGenerativeAI(config.geminiApiKey);

        this.toolDeclarations = [
            {
                name: "fetch_yield_pools",
                description: "Fetch current real-time BTC yield pools on Sui from DefiLlama. Returns pool name, protocol, APY, TVL, and more.",
                parameters: { type: "OBJECT", properties: {}, required: [] },
            },
            {
                name: "get_wallet_btc_positions",
                description: "Get a Sui wallet's current BTC token balances from on-chain data.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        address: { type: "STRING", description: "The Sui wallet address (0x...)" },
                    },
                    required: ["address"],
                },
            },
        ];

        const today = new Date().toLocaleDateString('en-GB', {
            timeZone: 'Asia/Bangkok',
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });

        this.systemInstruction = `You are OpenClawd, an AI Sentinel for the Sui blockchain.
Your mission is to help users optimize their Bitcoin (BTC) yields on Sui.
You are helpful, concise, and technical but accessible.
You always sign off with a "🦞" emoji.
Today's date: ${today} (GMT+7).
You have access to live tools: you can fetch real-time DeFi yield pool data from DefiLlama and read on-chain Sui wallet BTC positions. When a user asks about yields, pools, or wallet positions, use your tools to get live data — do not say you cannot access real-time data.`;

        this.model = this.genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            systemInstruction: this.systemInstruction,
            tools: [{ functionDeclarations: this.toolDeclarations }],
        });

        this.imageModel = this.genAI.getGenerativeModel({
            model: "gemini-2.0-flash-exp",
            systemInstruction: this.systemInstruction,
            generationConfig: {
                responseModalities: ["Text", "Image"],
            },
        });

        this.sessions = new Map();
        this.imageSessions = new Map();

        this._pruneTimer = setInterval(() => this._pruneSessions(), PRUNE_INTERVAL);
        this._pruneTimer.unref();
    }

    _getSession(chatId) {
        const key = String(chatId);
        const existing = this.sessions.get(key);
        if (existing) {
            existing.lastUsed = Date.now();
            return existing.session;
        }

        const session = this.model.startChat();
        this.sessions.set(key, { session, lastUsed: Date.now() });
        return session;
    }

    _getImageSession(chatId) {
        const key = String(chatId);
        const existing = this.imageSessions.get(key);
        if (existing) {
            existing.lastUsed = Date.now();
            return existing.session;
        }

        const session = this.imageModel.startChat();
        this.imageSessions.set(key, { session, lastUsed: Date.now() });
        return session;
    }

    _pruneSessions() {
        const now = Date.now();
        for (const [key, entry] of this.sessions) {
            if (now - entry.lastUsed > SESSION_TTL) {
                this.sessions.delete(key);
            }
        }
        for (const [key, entry] of this.imageSessions) {
            if (now - entry.lastUsed > SESSION_TTL) {
                this.imageSessions.delete(key);
            }
        }
    }

    /**
     * Safely extract text from a Gemini response, handling safety blocks
     * and empty responses gracefully.
     */
    _safeExtractText(result) {
        try {
            const response = result.response;
            if (!response) {
                return null;
            }

            // Check for safety blocks
            if (response.candidates && response.candidates.length > 0) {
                const candidate = response.candidates[0];
                if (candidate.finishReason === 'SAFETY') {
                    console.warn('Gemini response blocked by safety filter');
                    return null;
                }
            }

            // Check promptFeedback for blocks
            if (response.promptFeedback && response.promptFeedback.blockReason) {
                console.warn(`Gemini prompt blocked: ${response.promptFeedback.blockReason}`);
                return null;
            }

            const text = response.text();
            if (!text || text.trim().length === 0) {
                return null;
            }

            return text;
        } catch (err) {
            console.error('Failed to extract Gemini response text:', err.message);
            return null;
        }
    }

    /**
     * Truncate text to fit Telegram's message length limit.
     */
    _truncate(text) {
        if (text.length <= TELEGRAM_MAX_LENGTH) return text;
        return text.slice(0, TELEGRAM_MAX_LENGTH - 30) + '\n\n... (truncated) 🦞';
    }

    async _executeFunctionCall(name, args) {
        switch (name) {
            case "fetch_yield_pools": {
                const suiScanner = require('./SuiScanner');
                const pools = await suiScanner.fetchPools();
                return { pools: pools.slice(0, 15) };
            }
            case "get_wallet_btc_positions": {
                const suiClient = require('./SuiClient');
                const balances = await suiClient.getBtcBalances(args.address);
                return { address: args.address, balances };
            }
            default:
                return { error: `Unknown function: ${name}` };
        }
    }

    async _handleFunctionCallingLoop(session, result) {
        for (let i = 0; i < MAX_FUNCTION_CALLS; i++) {
            const response = result.response;
            if (!response || !response.candidates || response.candidates.length === 0) {
                return result;
            }

            const candidate = response.candidates[0];
            if (!candidate.content || !candidate.content.parts) {
                return result;
            }

            const functionCallPart = candidate.content.parts.find(p => p.functionCall);
            if (!functionCallPart) {
                return result;
            }

            const { name, args } = functionCallPart.functionCall;
            console.log(`Gemini function call: ${name}(${JSON.stringify(args)})`);

            let fnResult;
            try {
                fnResult = await this._executeFunctionCall(name, args || {});
            } catch (err) {
                console.error(`Function call ${name} failed:`, err.message);
                fnResult = { error: `Failed to execute ${name}: ${err.message}` };
            }

            result = await session.sendMessage([{
                functionResponse: {
                    name,
                    response: fnResult,
                },
            }], {
                signal: AbortSignal.timeout(FUNCTION_CALL_TIMEOUT),
            });
        }

        return result;
    }

    async chat(chatId, userMessage) {
        if (!userMessage) return "I didn't catch that. 🦞";

        try {
            const session = this._getSession(chatId);
            let result = await session.sendMessage(userMessage, {
                signal: AbortSignal.timeout(GEMINI_TIMEOUT),
            });
            result = await this._handleFunctionCallingLoop(session, result);
            const text = this._safeExtractText(result);
            if (!text) {
                return "I couldn't generate a response. Please try again. 🦞";
            }
            return this._truncate(text);
        } catch (error) {
            console.error("GeminiService Chat Error:", error.message);
            this.sessions.delete(String(chatId));
            return "My neural connection is unstable. Please try again later. 🦞";
        }
    }

    async chatWithImage(chatId, userMessage) {
        if (!userMessage) return { text: "I didn't catch that. 🦞", imageBuffer: null };

        try {
            const session = this._getImageSession(chatId);
            let result = await session.sendMessage(userMessage, {
                signal: AbortSignal.timeout(GEMINI_TIMEOUT),
            });
            result = await this._handleFunctionCallingLoop(session, result);

            const response = result.response;
            if (!response || !response.candidates || response.candidates.length === 0) {
                return { text: "I couldn't generate a response. Please try again. 🦞", imageBuffer: null };
            }

            const candidate = response.candidates[0];
            if (candidate.finishReason === 'SAFETY') {
                return { text: "That request was blocked by safety filters. 🦞", imageBuffer: null };
            }

            let text = null;
            let imageBuffer = null;

            for (const part of candidate.content.parts) {
                if (part.text) {
                    text = (text || '') + part.text;
                } else if (part.inlineData) {
                    imageBuffer = Buffer.from(part.inlineData.data, 'base64');
                }
            }

            if (text) text = this._truncate(text);

            if (!text && !imageBuffer) {
                return { text: "I couldn't generate a response. Please try again. 🦞", imageBuffer: null };
            }

            return { text, imageBuffer };
        } catch (error) {
            console.error("GeminiService ChatWithImage Error:", error.message);
            this.imageSessions.delete(String(chatId));
            // Fall back to text-only chat
            const fallback = await this.chat(chatId, userMessage);
            return { text: fallback, imageBuffer: null };
        }
    }

    async analyzeYields(poolsData) {
        try {
            const now = new Date().toLocaleDateString('en-GB', {
                timeZone: 'Asia/Bangkok',
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });

            const prompt = `You are OpenClawd Sentinel. Generate a "9 AM Mission Brief" for Sui BTCFi yields.

DATE: ${now} (GMT+7)

FORMAT the report EXACTLY like this:
- Header: "🦞 OPENCLAWD MISSION BRIEF — [date]"
- Section: "🎯 HIGH-YIELD MISSIONS" with the top 3 opportunities
- For EACH mission include:
  • Pool name and protocol
  • APY (percentage)
  • TVL (formatted in $M or $K)
  • Risk Score (1-5 scale): 1=Very Safe, 2=Safe, 3=Moderate, 4=Risky, 5=Very Risky
    Base this on TVL size (higher=safer), APY sustainability (extremely high APY=riskier), and protocol maturity
  • A simple ASCII strategy flow, e.g.: Wallet → Swap WBTC → Supply to Pool → Earn APY
- Section: "📡 MARKET SENTIMENT" — 2-3 sentence summary of the overall Sui BTC yield landscape
- Sign off with 🦞

Keep it clean for Telegram Markdown. Use bold (*text*) for emphasis.

POOL DATA (JSON):
${JSON.stringify(poolsData.slice(0, 10))}`;

            const result = await this.model.generateContent(prompt, {
                signal: AbortSignal.timeout(GEMINI_TIMEOUT),
            });
            const text = this._safeExtractText(result);
            if (!text) {
                return "Failed to generate the Mission Brief. 🦞";
            }
            return this._truncate(text);
        } catch (error) {
            console.error("GeminiService Analysis Error:", error.message);
            return "I failed to analyze the yield data. 🦞";
        }
    }

    async auditWallet(balances, topPools) {
        try {
            const prompt = `You are OpenClawd Sentinel. Generate a PERSONALIZED YIELD AUDIT for a Sui wallet.

USER'S CURRENT BTC HOLDINGS ON SUI:
${JSON.stringify(balances)}

TOP AVAILABLE BTC YIELD POOLS ON SUI:
${JSON.stringify(topPools.slice(0, 10))}

FORMAT the audit as follows:
- Header: "🔍 OPENCLAWD WALLET AUDIT"
- Section: "💰 CURRENT HOLDINGS" — summarize what the user holds
- Section: "🎯 RECOMMENDED ACTIONS" — for each recommendation include:
  • The target pool/protocol
  • Expected APY
  • Risk Score (1-5): 1=Very Safe, 2=Safe, 3=Moderate, 4=Risky, 5=Very Risky
  • Strategy flow: e.g. Wallet → Swap → Supply → Earn
  • Why this is a good move (1 sentence)
- Section: "⚠️ RISKS" — brief risk summary
- Sign off with 🦞

Keep it clean for Telegram Markdown. Be actionable and concise.`;

            const result = await this.model.generateContent(prompt, {
                signal: AbortSignal.timeout(GEMINI_TIMEOUT),
            });
            const text = this._safeExtractText(result);
            if (!text) {
                return "Failed to generate your wallet audit. 🦞";
            }
            return this._truncate(text);
        } catch (error) {
            console.error("GeminiService Audit Error:", error.message);
            return "I failed to generate your wallet audit. 🦞";
        }
    }
}

module.exports = new GeminiService();
