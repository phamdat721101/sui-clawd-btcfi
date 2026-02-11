const TelegramBot = require('node-telegram-bot-api');

const config = require('./config');

const TOKEN = config.telegramToken;

const bot = new TelegramBot(TOKEN, { polling: true });

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  console.log(`Message from ${msg.from?.username || msg.from?.id}: ${msg.text}`);
  bot.sendMessage(chatId, 'hi');
});

bot.on('polling_error', (err) => {
  console.error('Polling error:', err.message);
});

console.log('Bot started — listening for messages...');
