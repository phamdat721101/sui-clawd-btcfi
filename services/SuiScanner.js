const axios = require('axios');
const GeminiService = require('./GeminiService');

class SuiScanner {
    async fetchPools() {
        console.log('Fetching data from DefiLlama...');
        const response = await axios.get('https://yields.llama.fi/pools');

        if (!response.data || !response.data.data) {
            throw new Error('Invalid data format from DefiLlama');
        }

        const suiPools = response.data.data.filter(pool =>
            pool.chain === 'Sui' &&
            pool.symbol.toUpperCase().includes('BTC') &&
            pool.tvlUsd > 10000
        );

        suiPools.sort((a, b) => b.apy - a.apy);
        return suiPools;
    }

    async getLeaderboard() {
        try {
            const suiPools = await this.fetchPools();

            if (suiPools.length === 0) {
                return "I scanned the network but found no major BTC pools on Sui right now. 🦞";
            }

            console.log(`Found ${suiPools.length} BTC pools on Sui. Asking Gemini to analyze...`);
            return await GeminiService.analyzeYields(suiPools);
        } catch (error) {
            console.error('SuiScanner Error:', error.message);
            return "⚠️ Sentinel Error: I cannot reach the market data feeds. 🦞";
        }
    }
}

module.exports = new SuiScanner();
