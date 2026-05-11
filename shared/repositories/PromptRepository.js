import { SqliteRepository } from './SqliteRepository.js';

export class PromptRepository extends SqliteRepository {
    constructor() {
        super('prompt_versions');
    }

    saveVersion(key, content) {
        const last = this.db.prepare(
            `SELECT MAX(version) as lastVersion FROM prompt_versions WHERE key = ?`
        ).get(key);
        
        const nextVersion = (last?.lastVersion || 0) + 1;
        
        return this.create({
            key,
            version: nextVersion,
            content
        });
    }

    getHistory(key) {
        return this.db.prepare(
            `SELECT * FROM prompt_versions WHERE key = ? ORDER BY version DESC`
        ).all(key);
    }

    getLatest(key) {
        return this.db.prepare(
            `SELECT * FROM prompt_versions WHERE key = ? ORDER BY version DESC LIMIT 1`
        ).get(key);
    }

    getAllLatest() {
        return this.db.prepare(`
            SELECT p1.*
            FROM prompt_versions p1
            INNER JOIN (
                SELECT key, MAX(version) as max_v
                FROM prompt_versions
                GROUP BY key
            ) p2 ON p1.key = p2.key AND p1.version = p2.max_v
        `).all();
    }

    rollback(key, versionId) {
        const oldVersion = this.findById(versionId);
        if (!oldVersion) throw new Error('Version not found');
        return this.saveVersion(key, oldVersion.content);
    }
}
