export function up(db) {
  console.log('Running safety limits migration...');

  try {
    // Check if created_at exists
    const tableInfo = db.pragma('table_info(connections)');
    const hasCreatedAt = tableInfo.some(col => col.name === 'created_at');

    if (!hasCreatedAt) {
      db.exec(`
        ALTER TABLE connections ADD COLUMN created_at TIMESTAMP;
        UPDATE connections SET created_at = updated_at;
      `);
      console.log('Added created_at column and backfilled data.');
    }

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_connections_status ON connections(status);
      CREATE INDEX IF NOT EXISTS idx_connections_created_at ON connections(created_at);
    `);
    console.log('Indexes created successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}
