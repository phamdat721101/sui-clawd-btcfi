require('dotenv').config();

const config = {
    telegramToken: process.env.TELEGRAM_BOT_TOKEN,
    geminiApiKey: process.env.GEMINI_API_KEY,
    suiRpcUrl: process.env.SUI_RPC_URL || 'https://fullnode.mainnet.sui.io:443',
    adminChatId: process.env.ADMIN_CHAT_ID || null,
    dataDir: process.env.DATA_DIR || './data',
    httpTimeout: parseInt(process.env.HTTP_TIMEOUT, 10) || 15000,
};

// Validate required environment variables
const requiredConfig = ['telegramToken', 'geminiApiKey'];
const missingConfig = requiredConfig.filter((key) => !config[key]);

if (missingConfig.length > 0) {
    console.error(`Missing required environment variables: ${missingConfig.join(', ')}`);
    process.exit(1);
}

module.exports = config;
