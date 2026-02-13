const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const SuiScanner = require('./services/SuiScanner');
const Scheduler = require('./services/Scheduler');
const GeminiService = require('./services/GeminiService');
const subscriberStore = require('./services/SubscriberStore');
const WalletAuditor = require('./services/WalletAuditor');

// --- Global Error Handlers ---
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
});

// --- Rate Limiter ---
const RATE_LIMIT_MS = 2000;
const rateLimitMap = new Map();

function isRateLimited(chatId) {
    const now = Date.now();
    const last = rateLimitMap.get(chatId);
    if (last && now - last < RATE_LIMIT_MS) return true;
    rateLimitMap.set(chatId, now);
    return false;
}

// --- Safe Send ---
async function safeSend(bot, chatId, text, opts) {
    try {
        await bot.sendMessage(chatId, text, opts);
    } catch (err) {
        if (opts && opts.parse_mode) {
            try {
                await bot.sendMessage(chatId, text);
            } catch (retryErr) {
                console.error(`safeSend failed for ${chatId}:`, retryErr.message);
            }
        } else {
            console.error(`safeSend failed for ${chatId}:`, err.message);
        }
    }
}

// --- Bot Setup ---
const bot = new TelegramBot(config.telegramToken, { polling: true });
const scheduler = new Scheduler(bot);
scheduler.start();

console.log('OpenClawd Sentinel initializing...');

// --- Command Handlers ---

// /start
bot.onText(/\/start/, (msg) => {
    safeSend(bot, msg.chat.id,
        `👋 *OpenClawd Sentinel Online*\n\nI monitor Sui BTCFi yields.\n\n` +
        `*Commands:*\n` +
        `/yield - Top BTC Yields 📊\n` +
        `/subscribe - Daily yield reports 🔔\n` +
        `/unsubscribe - Stop daily reports 🔕\n` +
        `/wallet <address> - Link your Sui wallet 🔗\n` +
        `/positions - View BTC positions 💰\n` +
        `/audit - Personalized yield audit 🔍\n` +
        `/rebalance - Auto-Compound (Coming Soon) 🦞`,
        { parse_mode: 'Markdown' }
    );
});

// /yield
bot.onText(/\/yield/, async (msg) => {
    const chatId = msg.chat.id;
    bot.sendChatAction(chatId, 'typing').catch(() => {});
    try {
        const report = await SuiScanner.getLeaderboard();
        safeSend(bot, chatId, report, { parse_mode: 'Markdown' });
    } catch (err) {
        console.error("Yield Command Error:", err);
        safeSend(bot, chatId, "Failed to fetch yields. 🦞");
    }
});

// /subscribe
bot.onText(/\/subscribe/, (msg) => {
    const chatId = msg.chat.id;
    subscriberStore.subscribe(chatId);
    safeSend(bot, chatId, "You're subscribed to daily yield reports at 09:00 AM. 🔔🦞", { parse_mode: 'Markdown' });
});

// /unsubscribe
bot.onText(/\/unsubscribe/, (msg) => {
    const chatId = msg.chat.id;
    subscriberStore.unsubscribe(chatId);
    safeSend(bot, chatId, "You've been unsubscribed from daily reports. 🔕🦞", { parse_mode: 'Markdown' });
});

// /wallet <address>
bot.onText(/\/wallet(?:\s+(.+))?/, (msg, match) => {
    const chatId = msg.chat.id;
    const address = match[1] ? match[1].trim() : null;

    if (!address) {
        safeSend(bot, chatId, "Usage: `/wallet 0xYourSuiAddress`\n\nLink your Sui wallet for positions & audit features. 🦞", { parse_mode: 'Markdown' });
        return;
    }

    if (!/^0x[a-fA-F0-9]{64}$/.test(address)) {
        safeSend(bot, chatId, "Invalid Sui address. It should be `0x` followed by 64 hex characters. 🦞", { parse_mode: 'Markdown' });
        return;
    }

    subscriberStore.setWallet(chatId, address);
    safeSend(bot, chatId, `Wallet linked: \`${address.slice(0, 8)}...${address.slice(-6)}\` 🔗🦞`, { parse_mode: 'Markdown' });
});

// /positions
bot.onText(/\/positions/, async (msg) => {
    const chatId = msg.chat.id;
    const wallet = subscriberStore.getWallet(chatId);

    if (!wallet) {
        safeSend(bot, chatId, "No wallet linked. Use `/wallet 0xYourAddress` first. 🦞", { parse_mode: 'Markdown' });
        return;
    }

    bot.sendChatAction(chatId, 'typing').catch(() => {});
    try {
        const report = await WalletAuditor.getPositions(wallet);
        safeSend(bot, chatId, report, { parse_mode: 'Markdown' });
    } catch (err) {
        console.error("Positions Command Error:", err);
        safeSend(bot, chatId, "Failed to fetch positions. 🦞");
    }
});

// /audit
bot.onText(/\/audit/, async (msg) => {
    const chatId = msg.chat.id;
    const wallet = subscriberStore.getWallet(chatId);

    if (!wallet) {
        safeSend(bot, chatId, "No wallet linked. Use `/wallet 0xYourAddress` first. 🦞", { parse_mode: 'Markdown' });
        return;
    }

    bot.sendChatAction(chatId, 'typing').catch(() => {});
    try {
        const report = await WalletAuditor.audit(wallet);
        safeSend(bot, chatId, report, { parse_mode: 'Markdown' });
    } catch (err) {
        console.error("Audit Command Error:", err);
        safeSend(bot, chatId, "Failed to generate audit report. 🦞");
    }
});

// /rebalance
bot.onText(/\/rebalance/, (msg) => {
    safeSend(bot, msg.chat.id, "🦞 *Phase 2 Feature:* Automated PTB Rebalancing is coming soon!", { parse_mode: 'Markdown' });
});

// --- General Message Handler (Chat) ---
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text) return;
    if (text.startsWith('/')) return;
    if (isRateLimited(chatId)) return;

    console.log(`[Chat] User ${msg.from.username || msg.from.id}: ${text}`);

    bot.sendChatAction(chatId, 'typing').catch(() => {});
    try {
        const result = await GeminiService.chatWithImage(chatId, text);

        if (result.imageBuffer) {
            try {
                await bot.sendPhoto(chatId, result.imageBuffer, {
                    caption: result.text || undefined,
                    parse_mode: result.text ? 'Markdown' : undefined,
                });
            } catch (photoErr) {
                console.error("sendPhoto failed, falling back to text:", photoErr.message);
                if (result.text) {
                    safeSend(bot, chatId, result.text, { parse_mode: 'Markdown' });
                } else {
                    safeSend(bot, chatId, "I generated an image but couldn't send it. 🦞");
                }
            }
        } else if (result.text) {
            safeSend(bot, chatId, result.text, { parse_mode: 'Markdown' });
        }
    } catch (err) {
        console.error("Chat Error:", err);
        safeSend(bot, chatId, "I'm offline briefly. 🦞");
    }
});

// --- Error Handling ---
bot.on('polling_error', (error) => {
    console.error(`[Polling Error] ${error.code}: ${error.message}`);
});

console.log('OpenClawd Sentinel is listening. 🦞');
