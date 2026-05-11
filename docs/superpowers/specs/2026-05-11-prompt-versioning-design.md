# Prompt Versioning System Design

**Goal:** Implement a prompt versioning system using the `prompt_versions` table in SQLite.

## Architecture
- **PromptRepository:** A new repository class extending `SqliteRepository` to manage prompt versions.
- **Prompt Routes:** Updated Express routes to provide history, save new versions, and rollback functionality.

## Data Model
Table: `prompt_versions`
- `id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `key`: TEXT (e.g., 'connection_note')
- `version`: INTEGER (auto-incremented per key)
- `content`: TEXT
- `created_at`: TIMESTAMP

## Components

### PromptRepository
- `saveVersion(key, content)`: 
    - Fetches the current max version for the key.
    - Increments version.
    - Inserts new row.
- `getHistory(key)`: 
    - `SELECT * FROM prompt_versions WHERE key = ? ORDER BY version DESC`
- `getLatest(key)`: 
    - `SELECT * FROM prompt_versions WHERE key = ? ORDER BY version DESC LIMIT 1`
- `getAllLatest()`:
    - `SELECT * FROM prompt_versions WHERE id IN (SELECT MAX(id) FROM prompt_versions GROUP BY key)`
- `rollback(key, versionId)`:
    - Fetches content of `versionId`.
    - Calls `saveVersion(key, content)` to create a new version with that content.

### Routes (backend-api/routes/prompts.js)
- `GET /api/prompts`: Returns the latest version of all prompts.
- `POST /api/prompts`: Update multiple prompts (compatibility with current UI).
- `GET /api/prompts/:key/history`: Returns version history for a specific prompt key.
- `POST /api/prompts/:key`: Saves a new version for a specific prompt key.
- `POST /api/prompts/:key/rollback/:versionId`: Rollbacks to a specific version.

## Testing Strategy
- **Unit Tests:** `shared/repositories/PromptRepository.test.js` using a mock database or the actual test database.
- **Integration Tests:** Verify routes via manual or automated tests if feasible.
