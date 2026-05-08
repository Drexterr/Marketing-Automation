import { SqliteRepository } from './SqliteRepository.js';

export class ConnectionRepository extends SqliteRepository {
    constructor() {
        super('connections');
    }

    findByProfileUrl(profileUrl) {
        return this.db.prepare(`SELECT * FROM connections WHERE profile_url = ?`).get(profileUrl);
    }

    upsert(data) {
        const existing = this.findByProfileUrl(data.profile_url);
        if (existing) {
            return this.update(existing.id, data);
        } else {
            return this.create(data);
        }
    }
}
