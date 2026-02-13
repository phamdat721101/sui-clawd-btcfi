const schedule = require('node-schedule');
const suiScanner = require('./SuiScanner');
const subscriberStore = require('./SubscriberStore');

const SEND_TIMEOUT = 10000;

class Scheduler {
    constructor(bot) {
        this.bot = bot;
    }

    start() {
        schedule.scheduleJob({ rule: '0 9 * * *', tz: 'Asia/Bangkok' }, async () => {
            const subscribers = subscriberStore.getAllSubscribers();
            if (subscribers.length === 0) {
                console.log('Daily report skipped: no subscribers.');
                return;
            }

            console.log(`Running daily yield report for ${subscribers.length} subscriber(s)...`);
            try {
                const report = await suiScanner.getLeaderboard();

                const results = await Promise.allSettled(
                    subscribers.map(chatId =>
                        Promise.race([
                            this.bot.sendMessage(chatId, report, { parse_mode: 'Markdown' }),
                            new Promise((_, reject) =>
                                setTimeout(() => reject(new Error('send timeout')), SEND_TIMEOUT)
                            ),
                        ])
                    )
                );

                const failed = results.filter(r => r.status === 'rejected');
                if (failed.length > 0) {
                    console.error(`Daily report: ${failed.length}/${subscribers.length} deliveries failed`);
                }
            } catch (err) {
                console.error('Daily report generation failed:', err.message);
            }
        });

        console.log('Scheduler started: Daily reports at 09:00 AM (GMT+7)');
    }
}

module.exports = Scheduler;
