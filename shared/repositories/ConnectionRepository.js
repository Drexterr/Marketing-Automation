import { SqliteRepository } from './SqliteRepository.js';

export class ConnectionRepository extends SqliteRepository {
    constructor() {
        super('connections');
    }

    findByProfileUrl(profileUrl) {
        return this.db.prepare(`SELECT * FROM connections WHERE profile_url = ?`).get(profileUrl);
    }

    upsert(profileUrl, status, lastAction, data) {
        const now = new Date().toISOString();
        const dataStr = JSON.stringify(data || {});

        this.db.prepare(`
            INSERT INTO connections (profile_url, status, last_action, data, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(profile_url) DO UPDATE SET
                status = COALESCE(excluded.status, connections.status),
                last_action = COALESCE(excluded.last_action, connections.last_action),
                data = json_patch(connections.data, excluded.data),
                updated_at = excluded.updated_at
        `).run(profileUrl, status, lastAction, dataStr, now, now);

        return this.findByProfileUrl(profileUrl);
    }

    countSentInLast7Days() {
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        return this.db.prepare(`
            SELECT COUNT(*) as count FROM connections 
            WHERE status = 'sent' AND updated_at > ?
        `).get(oneWeekAgo).count;
    }

    countSentToday() {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const startOfDayIso = startOfDay.toISOString();
        return this.db.prepare(`
            SELECT COUNT(*) as count FROM connections 
            WHERE (status = 'sent' OR status = 'accepted') AND updated_at > ?
        `).get(startOfDayIso).count;
    }

    findAllConnections() {
        const records = this.findAll();
        return records.map(r => ({
            ...JSON.parse(r.data || '{}'),
            id: r.id,
            profile_url: r.profile_url,
            status: r.status,
            last_action: r.last_action,
            updated_at: r.updated_at
        }));
    }
}
