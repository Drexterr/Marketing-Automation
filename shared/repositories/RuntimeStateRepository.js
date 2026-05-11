import { SqliteRepository } from './SqliteRepository.js';

export class RuntimeStateRepository extends SqliteRepository {
    constructor() {
        super('runtime_state');
    }

    get(key) {
        const row = this.db.prepare(`SELECT value FROM runtime_state WHERE key = ?`).get(key);
        return row ? JSON.parse(row.value) : null;
    }

    set(key, value) {
        const jsonValue = JSON.stringify(value);
        this.db.prepare(
            `INSERT OR REPLACE INTO runtime_state (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)`
        ).run(key, jsonValue);
    }
}
