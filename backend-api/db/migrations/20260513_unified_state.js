export function up(db) {
    console.log('Running unified state migration...');
    try {
        db.prepare('ALTER TABLE connections ADD COLUMN state TEXT DEFAULT "pending"').run();
        console.log('Added state column to connections table.');
    } catch (e) {
        if (e.message.includes('duplicate column name')) {
            console.log('State column already exists.');
        } else {
            console.error('Failed to add state column:', e.message);
        }
    }

    const tableInfo = db.pragma('table_info(connections)');
    const hasStatus = tableInfo.some(col => col.name === 'status');

    if (hasStatus) {
        const result = db.prepare(`
            UPDATE connections SET state = 
            CASE 
                WHEN status = 'failed' THEN 'failed'
                WHEN status = 'accepted' AND json_extract(data, '$.stage') = 'connected' THEN 'connected'
                WHEN status = 'accepted' AND json_extract(data, '$.stage') = 'sending_first_message' THEN 'sending_first_message'
                WHEN status = 'accepted' AND json_extract(data, '$.stage') = 'first_message_sent' THEN 'first_message_sent'
                WHEN status = 'accepted' AND json_extract(data, '$.stage') = 'replied' THEN 'replied'
                WHEN status = 'accepted' AND json_extract(data, '$.stage') = 'conversation_active' THEN 'conversation_active'
                WHEN status = 'accepted' AND json_extract(data, '$.stage') = 'interested' THEN 'interested'
                WHEN status = 'accepted' AND json_extract(data, '$.stage') = 'followup_eligible' THEN 'followup_eligible'
                WHEN status = 'sent' AND json_extract(data, '$.stage') = 'request_sent' THEN 'request_sent'
                WHEN status = 'sent' AND json_extract(data, '$.stage') = 'sending_connection' THEN 'sending_connection'
                WHEN status = 'pending' THEN 'pending'
                ELSE 'pending'
            END
        `).run();
        console.log(`Migrated ${result.changes} records to new unified state.`);
    } else {
        console.log('Status column does not exist, skipping data migration.');
    }

    try {
        db.prepare('CREATE INDEX IF NOT EXISTS idx_connections_state ON connections(state)').run();
        console.log('Created index on state column.');
    } catch (e) {
        console.error('Failed to create index:', e.message);
    }
}
