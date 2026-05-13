import { SqliteRepository } from './SqliteRepository.js';

export class ConnectionRepository extends SqliteRepository {
    constructor() {
        super('connections');
    }

    findByProfileUrl(profileUrl) {
        return this.db.prepare(`SELECT * FROM connections WHERE profile_url = ?`).get(profileUrl);
    }

    upsert(profileUrl, state, data) {
        const now = new Date().toISOString();
        const dataStr = JSON.stringify(data || {});

        this.db.prepare(`
            INSERT INTO connections (profile_url, state, data, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(profile_url) DO UPDATE SET
                state = COALESCE(excluded.state, connections.state),
                data = json_patch(connections.data, excluded.data),
                updated_at = excluded.updated_at
        `).run(profileUrl, state, dataStr, now, now);

        return this.findByProfileUrl(profileUrl);
    }

    countSentInLast7Days() {
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        return this.db.prepare(`
            SELECT COUNT(*) as count FROM connections 
            WHERE state = 'request_sent' AND updated_at > ?
        `).get(oneWeekAgo).count;
    }

    countSentToday() {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const startOfDayIso = startOfDay.toISOString();
        return this.db.prepare(`
            SELECT COUNT(*) as count FROM connections 
            WHERE state IN ('request_sent', 'connected', 'sending_first_message', 'first_message_sent', 'replied', 'conversation_active', 'interested', 'followup_eligible') AND updated_at > ?
        `).get(startOfDayIso).count;
    }

    findAllConnections() {
        const records = this.findAll();
        return records.map(r => ({
            ...JSON.parse(r.data || '{}'),
            id: r.id,
            profile_url: r.profile_url,
            state: r.state,
            updated_at: r.updated_at
        }));
    }
}
