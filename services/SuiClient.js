const axios = require('axios');
const config = require('../config');

const BTC_COIN_TYPES = [
    '::btc::',
    '::wbtc::',
    '::sbtc::',
    '::lbtc::',
    '::fbtc::',
    '::mbtc::',
    '::cbtc::',
];

class SuiClient {
    constructor() {
        this.rpcUrl = config.suiRpcUrl;
    }

    async _rpc(method, params) {
        const { data } = await axios.post(this.rpcUrl, {
            jsonrpc: '2.0',
            id: 1,
            method,
            params,
        });
        if (data.error) {
            throw new Error(`Sui RPC ${method}: ${data.error.message}`);
        }
        return data.result;
    }

    async getBalances(address) {
        return this._rpc('suix_getAllBalances', [address]);
    }

    getBtcBalances(address) {
        return this.getBalances(address).then(balances =>
            balances.filter(b =>
                BTC_COIN_TYPES.some(t => b.coinType.toLowerCase().includes(t))
            )
        );
    }

    async getOwnedObjects(address, cursor = null, limit = 50) {
        return this._rpc('suix_getOwnedObjects', [
            address,
            { options: { showType: true, showContent: true } },
            cursor,
            limit,
        ]);
    }
}

module.exports = new SuiClient();
