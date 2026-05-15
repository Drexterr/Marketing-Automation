import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve('database/cue-os.sqlite');
const db = new Database(dbPath);

try {
    const rows = db.prepare('SELECT * FROM prompt_versions').all();
    console.log(JSON.stringify(rows, null, 2));
} catch (e) {
    console.error(e);
} finally {
    db.close();
}
