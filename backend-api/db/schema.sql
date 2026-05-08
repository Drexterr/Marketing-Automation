CREATE TABLE IF NOT EXISTS runtime_state (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_url TEXT UNIQUE,
    status TEXT,
    last_action TEXT,
    data TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_url TEXT,
    thread_id TEXT,
    content TEXT,
    direction TEXT, -- 'sent', 'received'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS review_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT, -- 'message', 'connection', 'post'
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'completed'
    data TEXT, -- JSON blob of the item
    response TEXT, -- Final text to be sent/posted
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS prompt_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT, -- e.g., 'connect-message'
    version INTEGER,
    content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT,
    module TEXT,
    details TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scheduler_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    status TEXT -- 'running', 'completed', 'failed'
);

-- Seed initial runtime state
INSERT OR IGNORE INTO runtime_state (key, value) VALUES ('scheduler_enabled', 'false');
INSERT OR IGNORE INTO runtime_state (key, value) VALUES ('emergency_stop', 'false');
