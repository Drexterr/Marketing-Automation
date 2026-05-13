export function up(db) {
    try {
        db.exec(`ALTER TABLE scheduler_runs ADD COLUMN task_name TEXT`);
    } catch (e) {
        if (!e.message.includes('duplicate column name')) {
            throw e;
        }
    }
}