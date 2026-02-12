const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('../config');

class GeminiService {
    constructor() {
        this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        this.identity = `
            You are OpenClawd, an AI Sentinel for the Sui blockchain.
            Your mission is to help users optimize their Bitcoin (BTC) yields on Sui.
            You are helpful, concise, and technical but accessible.
            You always sign off with a "🦞" emoji.
        `;
    }

    async chat(userMessage) {
        if (!userMessage) return "I didn't catch that. 🦞";

        try {
            const prompt = `${this.identity}\n\nUser: ${userMessage}\nSentinel:`;
            const result = await this.model.generateContent(prompt);
            return result.response.text();
        } catch (error) {
            console.error("GeminiService Chat Error:", error.message);
            return "My neural connection is unstable. Please try again later. 🦞";
        }
    }

    async analyzeYields(poolsData) {
        try {
            const prompt = `
                ${this.identity}

                ANALYZE the following Sui BTCFi yield data (JSON).
                IDENTIFY the top 3 best opportunities (APY + TVL).
                FORMAT as a clean Telegram message. Use emojis.

                DATA:
                ${JSON.stringify(poolsData.slice(0, 10))}
            `;

            const result = await this.model.generateContent(prompt);
            return result.response.text();
        } catch (error) {
            console.error("GeminiService Analysis Error:", error.message);
            return "I failed to analyze the yield data. 🦞";
        }
    }

    async auditWallet(balances, topPools) {
        try {
            const prompt = `
                ${this.identity}

                A user wants a PERSONALIZED YIELD AUDIT.

                Their current BTC holdings on Sui:
                ${JSON.stringify(balances)}

                Top available BTC yield pools on Sui right now:
                ${JSON.stringify(topPools.slice(0, 10))}

                COMPARE their holdings to the best available yields.
                IDENTIFY opportunities they are missing.
                SUGGEST specific actions to improve their yield.
                FORMAT as a clean Telegram message with emojis.
                Keep it actionable and concise.
            `;

            const result = await this.model.generateContent(prompt);
            return result.response.text();
        } catch (error) {
            console.error("GeminiService Audit Error:", error.message);
            return "I failed to generate your wallet audit. 🦞";
        }
    }
}

module.exports = new GeminiService();
