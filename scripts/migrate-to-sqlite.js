import fs from 'fs';
import path from 'path';
import { ConnectionRepository } from '../shared/repositories/ConnectionRepository.js';
import { RuntimeStateRepository } from '../shared/repositories/RuntimeStateRepository.js';
import { ActivityRepository } from '../shared/repositories/ActivityRepository.js';

const connectionRepo = new ConnectionRepository();
const stateRepo = new RuntimeStateRepository();
const activityRepo = new ActivityRepository();

async function migrate() {
    console.log('Starting migration to SQLite...');

    // 1. Migrate system-state.json
    const statePath = path.resolve('data/system-state.json');
    if (fs.existsSync(statePath)) {
        console.log('Migrating system-state.json...');
        const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        for (const [key, value] of Object.entries(state)) {
            stateRepo.set(key, value);
        }
    }

    // 2. Migrate connections-sent.json (NDJSON)
    const connectionsPath = path.resolve('data/connections-sent.json');
    if (fs.existsSync(connectionsPath)) {
        console.log('Migrating connections-sent.json...');
        const lines = fs.readFileSync(connectionsPath, 'utf8').trim().split('\n');
        for (const line of lines) {
            if (!line) continue;
            const data = JSON.parse(line);
            connectionRepo.upsert({
                profile_url: data.url,
                status: data.status,
                last_action: data.stage || 'sent',
                data: JSON.stringify(data),
                updated_at: data.timestamp || new Date().toISOString()
            });
        }
    }

    // 3. Migrate dashboard-summary.json (as activity or state)
    const dashboardPath = path.resolve('data/dashboard-summary.json');
    if (fs.existsSync(dashboardPath)) {
        console.log('Migrating dashboard-summary.json...');
        const dashboard = JSON.parse(fs.readFileSync(dashboardPath, 'utf8'));
        stateRepo.set('dashboard_summary', dashboard);
        activityRepo.log('MIGRATION', 'SYSTEM', { message: 'Migrated dashboard summary from JSON' });
    }

    console.log('Migration complete!');
}

migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
