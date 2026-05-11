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
        const keys = Object.keys(data);
        const values = Object.values(data);
        const placeholders = keys.map(() => '?').join(',');
        const info = this.db.prepare(
            `INSERT INTO ${this.tableName} (${keys.join(',')}) VALUES (${placeholders})`
        ).run(...values);
        return { ...data, id: info.lastInsertRowid };
    }

    update(id, data) {
        const keys = Object.keys(data);
        const values = Object.values(data);
        const setClause = keys.map(k => `${k} = ?`).join(',');
        this.db.prepare(
            `UPDATE ${this.tableName} SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
        ).run(...values, id);
        return this.findById(id);
    }

    clear() {
        this.db.prepare(`DELETE FROM ${this.tableName}`).run();
    }
}
