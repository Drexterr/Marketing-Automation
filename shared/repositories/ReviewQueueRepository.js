import { SqliteRepository } from './SqliteRepository.js';

export class ReviewQueueRepository extends SqliteRepository {
    constructor() {
        super('review_queue');
    }

    getPending(category = null) {
        let query = `SELECT * FROM review_queue WHERE status = 'pending'`;
        const params = [];
        if (category) {
            query += ` AND category = ?`;
            params.push(category);
        }
        query += ` ORDER BY priority DESC, created_at ASC`;
        return this.db.prepare(query).all(...params);
    }

    updateStatus(id, status, response = null) {
        const data = { status };
        if (response !== null) data.response = typeof response === 'object' ? JSON.stringify(response) : response;
        return this.update(id, data);
    }

    acknowledge(id) {
        return this.update(id, { status: 'acknowledged' });
    }

    resolve(id, operatorNotes, response) {
        if (!operatorNotes) {
            throw new Error('operatorNotes required for resolution');
        }
        return this.update(id, {
            status: 'resolved',
            operator_notes: operatorNotes,
            response: typeof response === 'object' ? JSON.stringify(response) : response,
            resolved_at: new Date().toISOString()
        });
    }

    dismiss(id) {
        return this.update(id, { status: 'dismissed', resolved_at: new Date().toISOString() });
    }
}
