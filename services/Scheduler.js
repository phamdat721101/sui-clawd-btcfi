const schedule = require('node-schedule');
const suiScanner = require('./SuiScanner');
const subscriberStore = require('./SubscriberStore');

class Scheduler {
    constructor(bot) {
        this.bot = bot;
    }

    start() {
        schedule.scheduleJob('0 9 * * *', async () => {
            const subscribers = subscriberStore.getAllSubscribers();
            if (subscribers.length === 0) {
                console.log('Daily report skipped: no subscribers.');
                return;
            }

            console.log(`Running daily yield report for ${subscribers.length} subscriber(s)...`);
            try {
                const report = await suiScanner.getLeaderboard();
                for (const chatId of subscribers) {
                    try {
                        await this.bot.sendMessage(chatId, report, { parse_mode: 'Markdown' });
                    } catch (err) {
                        console.error(`Failed to send report to ${chatId}:`, err.message);
                    }
                }
            } catch (err) {
                console.error('Daily report generation failed:', err.message);
            }
        });

        console.log('Scheduler started: Daily reports at 09:00 AM');
    }
}

module.exports = Scheduler;
