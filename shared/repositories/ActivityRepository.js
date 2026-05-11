import { SqliteRepository } from './SqliteRepository.js';

export class ActivityRepository extends SqliteRepository {
    constructor() {
        super('activity_log');
    }

    log(eventType, module, details) {
        return this.create({
            event_type: eventType,
            module: module,
            details: typeof details === 'object' ? JSON.stringify(details) : details
        });
    }

    getRecent(limit = 50) {
        return this.db.prepare(
            `SELECT * FROM activity_log ORDER BY id DESC LIMIT ?`
        ).all(limit);
    }
}
