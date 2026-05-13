import Database from 'better-sqlite3';
const db = new Database('database/cue-os.sqlite');
const tableInfo = db.pragma('table_info(connections)');
console.log(JSON.stringify(tableInfo, null, 2));
db.close();
