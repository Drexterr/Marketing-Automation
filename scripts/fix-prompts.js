import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve('database/cue-os.sqlite');
const db = new Database(dbPath);

const DEFAULT_PROMPTS = {
  connection_note: "Write a short LinkedIn connection request note for {{name}} who works at {{company}}.",
  first_message: "Write a casual first message to {{name}} after they accepted my connection request.",
  feed_comment: "Write a 1-2 sentence thoughtful comment on this post: {{postContent}}",     
  auto_reply: "Write a supportive, non-salesy reply to this message: {{message}}",
  post_generation: "Generate a LinkedIn post about {{topic}} in a builder-to-builder tone."  
};

try {
    console.log('Cleaning up placeholder prompts...');
    db.prepare('DELETE FROM prompt_versions WHERE key IN (?, ?)').run('key1', 'key2');
    
    console.log('Seeding default prompts...');
    const insert = db.prepare('INSERT INTO prompt_versions (key, version, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)');
    
    const now = new Date().toISOString();
    for (const [key, content] of Object.entries(DEFAULT_PROMPTS)) {
        // Check if key already exists to avoid duplicates if they were somehow partially there
        const existing = db.prepare('SELECT id FROM prompt_versions WHERE key = ? LIMIT 1').get(key);
        if (!existing) {
            insert.run(key, 1, content, now, now);
            console.log(`Inserted: ${key}`);
        } else {
            console.log(`Skipped (already exists): ${key}`);
        }
    }
    
    console.log('Done.');
} catch (e) {
    console.error(e);
} finally {
    db.close();
}
