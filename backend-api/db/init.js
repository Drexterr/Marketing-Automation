import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dbPath = path.resolve('database/cue-os.sqlite');
const schemaPath = path.resolve('backend-api/db/schema.sql');

if (!fs.existsSync(path.dirname(dbPath))) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const schema = fs.readFileSync(schemaPath, 'utf8');
db.exec(schema);

export default db;
