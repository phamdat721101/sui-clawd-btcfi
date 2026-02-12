const SuiClient = require('./SuiClient');
const SuiScanner = require('./SuiScanner');
const GeminiService = require('./GeminiService');

class WalletAuditor {
    async audit(address) {
        const [btcBalances, topPools] = await Promise.all([
            SuiClient.getBtcBalances(address),
            SuiScanner.fetchPools(),
        ]);

        return GeminiService.auditWallet(btcBalances, topPools);
    }

    async getPositions(address) {
        const balances = await SuiClient.getBtcBalances(address);

        if (balances.length === 0) {
            return "No BTC positions found for this wallet on Sui. 🦞";
        }

        const lines = balances.map(b => {
            const amount = (BigInt(b.totalBalance) / BigInt(10 ** 8)).toString();
            const remainder = (BigInt(b.totalBalance) % BigInt(10 ** 8)).toString().padStart(8, '0').slice(0, 4);
            const typeParts = b.coinType.split('::');
            const symbol = typeParts[typeParts.length - 1].toUpperCase();
            return `  - *${symbol}*: ${amount}.${remainder}`;
        });

        return `*Your BTC Positions on Sui:*\n\n${lines.join('\n')}\n\n🦞`;
    }
}

module.exports = new WalletAuditor();
