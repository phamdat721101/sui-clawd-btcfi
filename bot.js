const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const SuiScanner = require('./services/SuiScanner');
const Scheduler = require('./services/Scheduler');
const GeminiService = require('./services/GeminiService');
const subscriberStore = require('./services/SubscriberStore');
const WalletAuditor = require('./services/WalletAuditor');

// --- Bot Setup ---
const bot = new TelegramBot(config.telegramToken, { polling: true });
const scheduler = new Scheduler(bot);
scheduler.start();

console.log('OpenClawd Sentinel initializing...');

// --- Command Handlers ---

// /start
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id,
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
    bot.sendChatAction(chatId, 'typing');
    try {
        const report = await SuiScanner.getLeaderboard();
        bot.sendMessage(chatId, report, { parse_mode: 'Markdown' });
    } catch (err) {
        console.error("Yield Command Error:", err);
        bot.sendMessage(chatId, "Failed to fetch yields. 🦞");
    }
});

// /subscribe
bot.onText(/\/subscribe/, (msg) => {
    const chatId = msg.chat.id;
    subscriberStore.subscribe(chatId);
    bot.sendMessage(chatId, "You're subscribed to daily yield reports at 09:00 AM. 🔔🦞", { parse_mode: 'Markdown' });
});

// /unsubscribe
bot.onText(/\/unsubscribe/, (msg) => {
    const chatId = msg.chat.id;
    subscriberStore.unsubscribe(chatId);
    bot.sendMessage(chatId, "You've been unsubscribed from daily reports. 🔕🦞", { parse_mode: 'Markdown' });
});

// /wallet <address>
bot.onText(/\/wallet(?:\s+(.+))?/, (msg, match) => {
    const chatId = msg.chat.id;
    const address = match[1] ? match[1].trim() : null;

    if (!address) {
        bot.sendMessage(chatId, "Usage: `/wallet 0xYourSuiAddress`\n\nLink your Sui wallet for positions & audit features. 🦞", { parse_mode: 'Markdown' });
        return;
    }

    if (!/^0x[a-fA-F0-9]{64}$/.test(address)) {
        bot.sendMessage(chatId, "Invalid Sui address. It should be `0x` followed by 64 hex characters. 🦞", { parse_mode: 'Markdown' });
        return;
    }

    subscriberStore.setWallet(chatId, address);
    bot.sendMessage(chatId, `Wallet linked: \`${address.slice(0, 8)}...${address.slice(-6)}\` 🔗🦞`, { parse_mode: 'Markdown' });
});

// /positions
bot.onText(/\/positions/, async (msg) => {
    const chatId = msg.chat.id;
    const wallet = subscriberStore.getWallet(chatId);

    if (!wallet) {
        bot.sendMessage(chatId, "No wallet linked. Use `/wallet 0xYourAddress` first. 🦞", { parse_mode: 'Markdown' });
        return;
    }

    bot.sendChatAction(chatId, 'typing');
    try {
        const report = await WalletAuditor.getPositions(wallet);
        bot.sendMessage(chatId, report, { parse_mode: 'Markdown' });
    } catch (err) {
        console.error("Positions Command Error:", err);
        bot.sendMessage(chatId, "Failed to fetch positions. 🦞");
    }
});

// /audit
bot.onText(/\/audit/, async (msg) => {
    const chatId = msg.chat.id;
    const wallet = subscriberStore.getWallet(chatId);

    if (!wallet) {
        bot.sendMessage(chatId, "No wallet linked. Use `/wallet 0xYourAddress` first. 🦞", { parse_mode: 'Markdown' });
        return;
    }

    bot.sendChatAction(chatId, 'typing');
    try {
        const report = await WalletAuditor.audit(wallet);
        bot.sendMessage(chatId, report, { parse_mode: 'Markdown' });
    } catch (err) {
        console.error("Audit Command Error:", err);
        bot.sendMessage(chatId, "Failed to generate audit report. 🦞");
    }
});

// /rebalance
bot.onText(/\/rebalance/, (msg) => {
    bot.sendMessage(msg.chat.id, "🦞 *Phase 2 Feature:* Automated PTB Rebalancing is coming soon!");
});

// --- General Message Handler (Chat) ---
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text) return;
    if (text.startsWith('/')) return;

    console.log(`[Chat] User ${msg.from.username || msg.from.id}: ${text}`);

    bot.sendChatAction(chatId, 'typing');
    try {
        const response = await GeminiService.chat(text);
        bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    } catch (err) {
        console.error("Chat Error:", err);
        bot.sendMessage(chatId, "I'm offline briefly. 🦞");
    }
});

// --- Error Handling ---
bot.on('polling_error', (error) => {
    console.error(`[Polling Error] ${error.code}: ${error.message}`);
});

console.log('OpenClawd Sentinel is listening. 🦞');
