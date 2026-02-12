# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**OpenClawd Sentinel** — a Telegram bot that monitors Sui blockchain BTCFi yields, reads on-chain wallet positions, and generates personalized yield audits. It uses Google Gemini 2.0 Flash for conversational AI and analysis, fetches pool data from the DefiLlama API, and reads wallet data from the Sui JSON-RPC.

## Commands

```bash
npm install        # Install dependencies
npm start          # Run the bot (node bot.js)
```

No test framework or linter is configured.

## Environment Variables

Copy `.env.example` to `.env` and fill in:
- `TELEGRAM_BOT_TOKEN` — Telegram Bot API token (required)
- `GEMINI_API_KEY` — Google Gemini API key (required)
- `SUI_RPC_URL` — Sui fullnode RPC (default: `https://fullnode.mainnet.sui.io:443`)
- `ADMIN_CHAT_ID` — Telegram chat ID for admin notifications (optional)
- `DATA_DIR` — Directory for persistent data (default: `./data`)

## Architecture

**Entry point:** `bot.js` — Sets up the Telegram bot with polling, registers command handlers (`/start`, `/yield`, `/subscribe`, `/unsubscribe`, `/wallet`, `/positions`, `/audit`, `/rebalance`), and routes non-command messages to the Gemini AI chat.

**Services (all singletons via `module.exports = new Class()`):**
- `services/GeminiService.js` — Wraps `@google/generative-ai` SDK. Provides `chat(text)`, `analyzeYields(poolsData)`, and `auditWallet(balances, topPools)`.
- `services/SuiScanner.js` — Fetches pool data from DefiLlama. `fetchPools()` returns filtered/sorted Sui BTC pools. `getLeaderboard()` delegates to GeminiService for analysis.
- `services/SuiClient.js` — Thin wrapper around Sui JSON-RPC (via axios). Provides `getBalances(address)`, `getBtcBalances(address)`, `getOwnedObjects(address)`.
- `services/WalletAuditor.js` — Compares user BTC holdings against top yield pools via Gemini. Provides `audit(address)` and `getPositions(address)`.
- `services/SubscriberStore.js` — JSON-file persistence at `{dataDir}/subscribers.json`. Manages subscriber chat IDs and linked wallet addresses.
- `services/Scheduler.js` — Uses `node-schedule` for daily yield reports at 09:00 AM, sent to all subscribers.

**Config:** `config.js` loads env vars via `dotenv` and validates required ones (`telegramToken`, `geminiApiKey`).

**Deployment:** `nim-bot.service` is a systemd unit file for running on Ubuntu at `/home/ubuntu/nim-bot`.

## Key Patterns

- CommonJS modules throughout (`require`/`module.exports`)
- Telegram messages use Markdown parse mode
- All user-facing error messages include the 🦞 emoji (bot persona signature)
- JSON-file persistence in `data/` directory (gitignored)
- Sui on-chain reads use direct JSON-RPC calls via axios (not the `@mysten/sui` SDK, which is ESM-only)
