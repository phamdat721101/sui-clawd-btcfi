const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const config = require('../config');

class SubscriberStore {
    constructor() {
        this.filePath = path.resolve(config.dataDir, 'subscribers.json');
        this._ensureDir();
        this.data = this._load();
        this._saving = false;
        this._dirty = false;
    }

    _ensureDir() {
        const dir = path.dirname(this.filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    _load() {
        try {
            if (fs.existsSync(this.filePath)) {
                return JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
            }
        } catch (err) {
            console.error('SubscriberStore load error:', err.message);
        }
        return {};
    }

    async _save() {
        if (this._saving) {
            this._dirty = true;
            return;
        }
        this._saving = true;
        try {
            const tmp = this.filePath + '.tmp';
            await fsp.writeFile(tmp, JSON.stringify(this.data, null, 2));
            await fsp.rename(tmp, this.filePath);
        } catch (err) {
            console.error('SubscriberStore save error:', err.message);
        } finally {
            this._saving = false;
            if (this._dirty) {
                this._dirty = false;
                this._save();
            }
        }
    }

    subscribe(chatId, wallet) {
        const key = String(chatId);
        this.data[key] = this.data[key] || {};
        this.data[key].subscribed = true;
        if (wallet) this.data[key].wallet = wallet;
        this._save();
    }

    unsubscribe(chatId) {
        const key = String(chatId);
        if (this.data[key]) {
            this.data[key].subscribed = false;
            this._save();
        }
    }

    isSubscribed(chatId) {
        const entry = this.data[String(chatId)];
        return entry ? entry.subscribed === true : false;
    }

    setWallet(chatId, address) {
        const key = String(chatId);
        this.data[key] = this.data[key] || {};
        this.data[key].wallet = address;
        this._save();
    }

    getWallet(chatId) {
        const entry = this.data[String(chatId)];
        return entry ? entry.wallet || null : null;
    }

    getAllSubscribers() {
        return Object.keys(this.data).filter(id => this.data[id].subscribed);
    }

    getAllWithWallets() {
        return Object.entries(this.data)
            .filter(([, v]) => v.wallet)
            .map(([id, v]) => ({ chatId: id, wallet: v.wallet }));
    }
}

module.exports = new SubscriberStore();
