export function up(db) {
    try {
        db.exec(`ALTER TABLE connections ADD COLUMN sent_at TIMESTAMP`);
    } catch (e) {
        // Ignore if column already exists
        if (!e.message.includes('duplicate column name')) {
            throw e;
        }
    }
    
    // Backfill existing records: if state indicates it was sent, set sent_at to updated_at.
    db.exec(`
        UPDATE connections 
        SET sent_at = updated_at 
        WHERE state IN ('request_sent', 'connected', 'sending_first_message', 'first_message_sent', 'replied', 'conversation_active', 'interested', 'followup_eligible') 
        AND sent_at IS NULL
    `);

    // Create index
    db.exec(`CREATE INDEX IF NOT EXISTS idx_connections_sent_at ON connections(sent_at)`);
}
