export function up(db) {
  const tables = [
    'runtime_state',
    'messages',
    'prompt_versions',
    'activity_log',
    'scheduler_runs'
  ];

  console.log('Running timestamp standardization migration...');

  for (const table of tables) {
    try {
      const tableInfo = db.pragma(`table_info(${table})`);
      const hasCreatedAt = tableInfo.some(col => col.name === 'created_at');
      const hasUpdatedAt = tableInfo.some(col => col.name === 'updated_at');

      if (!hasCreatedAt) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN created_at TIMESTAMP;`);
        console.log(`Added created_at to ${table}`);
      }
      if (!hasUpdatedAt) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN updated_at TIMESTAMP;`);
        console.log(`Added updated_at to ${table}`);
      }
      
      // Backfill
      db.exec(`UPDATE ${table} SET created_at = COALESCE(created_at, datetime('now')), updated_at = COALESCE(updated_at, datetime('now'));`);

    } catch (error) {
      console.warn(`Could not update table ${table}:`, error.message);
    }
  }

  console.log('Timestamp standardization complete.');
}
