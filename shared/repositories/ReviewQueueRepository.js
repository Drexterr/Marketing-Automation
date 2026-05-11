import { SqliteRepository } from './SqliteRepository.js';

export class ReviewQueueRepository extends SqliteRepository {
    constructor() {
        super('review_queue');
    }

    getPending() {
        return this.db.prepare(`SELECT * FROM review_queue WHERE status = 'pending'`).all();
    }

    updateStatus(id, status, response = null) {
        const data = { status };
        if (response !== null) data.response = typeof response === 'object' ? JSON.stringify(response) : response;
        return this.update(id, data);
    }
}
