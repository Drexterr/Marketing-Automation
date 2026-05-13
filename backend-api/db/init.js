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
db.pragma('busy_timeout = 5000');

const schema = fs.readFileSync(schemaPath, 'utf8');
db.exec(schema);

// Run migrations
const migrationsDir = path.resolve('backend-api/db/migrations');
if (fs.existsSync(migrationsDir)) {
    const migrations = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.js')).sort();
    for (const file of migrations) {
        try {
            const { up } = await import(`file://${path.join(migrationsDir, file)}`);
            if (typeof up === 'function') {
                console.log(`Running migration: ${file}`);
                up(db);
            }
        } catch (e) {
            console.error(`Failed to run migration: ${file}`, e);
        }
    }
}

export default db;
