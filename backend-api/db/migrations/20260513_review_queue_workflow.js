export function up(db) {
    console.log('Running review queue workflow migration...');

    try {
        const tableInfo = db.pragma('table_info(review_queue)');
        const columns = tableInfo.map(col => col.name);

        if (!columns.includes('priority')) {
            db.exec('ALTER TABLE review_queue ADD COLUMN priority INTEGER DEFAULT 0');
            console.log('Added priority column to review_queue');
        }
        if (!columns.includes('category')) {
            db.exec('ALTER TABLE review_queue ADD COLUMN category TEXT');
            console.log('Added category column to review_queue');
        }
        if (!columns.includes('operator_notes')) {
            db.exec('ALTER TABLE review_queue ADD COLUMN operator_notes TEXT');
            console.log('Added operator_notes column to review_queue');
        }
        if (!columns.includes('resolved_at')) {
            db.exec('ALTER TABLE review_queue ADD COLUMN resolved_at TIMESTAMP');
            console.log('Added resolved_at column to review_queue');
        }

        // Handle connections table state column if needed
        const connTableInfo = db.pragma('table_info(connections)');
        const connColumns = connTableInfo.map(col => col.name);
        if (!connColumns.includes('state')) {
            db.exec('ALTER TABLE connections ADD COLUMN state TEXT DEFAULT "pending"');
            if (connColumns.includes('status')) {
                db.exec('UPDATE connections SET state = status');
                console.log('Migrated status to state in connections');
            }
            db.exec('CREATE INDEX IF NOT EXISTS idx_connections_state ON connections(state)');
            console.log('Added state column to connections');
        }

    } catch (error) {
        console.error('Migration failed:', error);
    }
}
