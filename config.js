require('dotenv').config();

const config = {
    telegramToken: process.env.TELEGRAM_BOT_TOKEN,
    geminiApiKey: process.env.GEMINI_API_KEY,
};

// Validate required environment variables
const requiredConfig = ['telegramToken'];
const missingConfig = requiredConfig.filter((key) => !config[key]);

if (missingConfig.length > 0) {
    console.error(`Missing required environment variables: ${missingConfig.join(', ')}`);
    process.exit(1);
}

module.exports = config;
