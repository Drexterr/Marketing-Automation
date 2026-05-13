import db from '../../backend-api/db/init.js';

export class SqliteRepository {
    constructor(tableName) {
        // Validate table name strictly to prevent SQL injection in PRAGMA/queries
        if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
            throw new Error(`Invalid table name: ${tableName}`);
        }
        this.tableName = tableName;
        this.db = db;
        
        // Cache table schema columns
        try {
            const info = this.db.prepare(`PRAGMA table_info(${this.tableName})`).all();
            this.columns = info.map(col => col.name);
        } catch (e) {
            console.error(`Failed to fetch schema for ${this.tableName}`, e);
            this.columns = [];
        }
    }

    _filterData(data) {
        if (!this.columns || this.columns.length === 0) return data;
        const filtered = {};
        for (const [key, value] of Object.entries(data)) {
            if (this.columns.includes(key)) {
                filtered[key] = value;
            }
        }
        return filtered;
    }

    findAll() {
        return this.db.prepare(`SELECT * FROM ${this.tableName}`).all();
    }

    findById(id) {
        return this.db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`).get(id);
    }

    create(data) {
        const now = new Date().toISOString();
        const record = this._filterData({
            created_at: now,
            updated_at: now,
            ...data
        });
        const keys = Object.keys(record);
        if (keys.length === 0) throw new Error('No valid columns to insert');
        const values = Object.values(record);
        const placeholders = keys.map(() => '?').join(',');
        const info = this.db.prepare(
            `INSERT INTO ${this.tableName} (${keys.join(',')}) VALUES (${placeholders})`
        ).run(...values);
        return { ...record, id: info.lastInsertRowid };
    }

    update(id, data) {
        const now = new Date().toISOString();
        const record = this._filterData({
            ...data,
            updated_at: now
        });
        const keys = Object.keys(record);
        if (keys.length === 0) return this.findById(id);
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
