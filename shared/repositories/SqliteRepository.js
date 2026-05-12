import db from '../../backend-api/db/init.js';

export class SqliteRepository {
    constructor(tableName) {
        this.tableName = tableName;
        this.db = db;
    }

    findAll() {
        return this.db.prepare(`SELECT * FROM ${this.tableName}`).all();
    }

    findById(id) {
        return this.db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`).get(id);
    }

    create(data) {
        const now = new Date().toISOString();
        const record = {
            created_at: now,
            updated_at: now,
            ...data
        };
        const keys = Object.keys(record);
        const values = Object.values(record);
        const placeholders = keys.map(() => '?').join(',');
        const info = this.db.prepare(
            `INSERT INTO ${this.tableName} (${keys.join(',')}) VALUES (${placeholders})`
        ).run(...values);
        return { ...record, id: info.lastInsertRowid };
    }

    update(id, data) {
        const now = new Date().toISOString();
        const record = {
            ...data,
            updated_at: now
        };
        const keys = Object.keys(record);
        const values = Object.values(record);
        const setClause = keys.map(k => `${k} = ?`).join(',');
        this.db.prepare(
            `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`
        ).run(...values, id);
        return this.findById(id);
    }

    clear() {
        this.db.prepare(`DELETE FROM ${this.tableName}`).run();
    }
}
