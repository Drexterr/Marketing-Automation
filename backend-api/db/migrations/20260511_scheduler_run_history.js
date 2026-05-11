import db from '../init.js';

console.log('Running scheduler history migration...');
try {
  db.exec(`
    ALTER TABLE scheduler_runs ADD COLUMN failure_reason TEXT;
    ALTER TABLE scheduler_runs ADD COLUMN duration INTEGER;
    ALTER TABLE scheduler_runs ADD COLUMN records_processed INTEGER DEFAULT 0;
    ALTER TABLE scheduler_runs ADD COLUMN graceful_shutdown BOOLEAN DEFAULT 0;
  `);
  console.log('Added operational columns to scheduler_runs.');
} catch (error) {
  if (!error.message.includes('duplicate column name')) {
    console.error('Migration failed:', error);
    process.exit(1);
  } else {
    console.log('Columns already exist. Skipping.');
  }
}
