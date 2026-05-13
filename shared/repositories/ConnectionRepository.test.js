import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConnectionRepository } from './ConnectionRepository.js';

test('ConnectionRepository operations', async (t) => {
    const repo = new ConnectionRepository();

    await t.test('should upsert and find by profile url', () => {
        repo.clear();
        const profileUrl = 'https://www.linkedin.com/in/testuser/';
        const data = { note: 'Hello' };
        
        repo.upsert(profileUrl, 'request_sent', data);
        
        const found = repo.findByProfileUrl(profileUrl);
        assert.ok(found);
        assert.equal(found.profile_url, profileUrl);
        assert.equal(found.state, 'request_sent');
        assert.equal(JSON.parse(found.data).note, 'Hello');
        
        // Update
        repo.upsert(profileUrl, 'replied', { ...data, replied: true });
        const updated = repo.findByProfileUrl(profileUrl);
        assert.equal(updated.state, 'replied');
        assert.equal(JSON.parse(updated.data).replied, true);

        // Test COALESCE and json_patch in upsert
        repo.upsert(profileUrl, null, { new_field: 'value' });
        const patched = repo.findByProfileUrl(profileUrl);
        assert.equal(patched.state, 'replied'); // Should preserve existing state
        const patchedData = JSON.parse(patched.data);
        assert.equal(patchedData.note, 'Hello'); // Should preserve existing data
        assert.equal(patchedData.replied, true); // Should preserve existing data
        assert.equal(patchedData.new_field, 'value'); // Should add new field
    });

    await t.test('should count sent today', () => {
        repo.clear();
        repo.upsert('url1', 'request_sent', {});
        repo.upsert('url2', 'connected', {});
        repo.upsert('url3', 'pending', {});
        
        const count = repo.countSentToday();
        assert.equal(count, 2); // request_sent or connected
    });

    await t.test('should count sent today including those created earlier but updated today', () => {
        repo.clear();
        
        // Manually insert a record created yesterday but updated today
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const now = new Date().toISOString();
        
        repo.db.prepare(`
            INSERT INTO connections (profile_url, state, data, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
        `).run('old-url', 'request_sent', '{}', yesterday, now);
        
        const count = repo.countSentToday();
        assert.equal(count, 1, 'Should count connection updated today even if created yesterday');
    });

    await t.test('should count sent in last 7 days', () => {
        repo.clear();
        repo.upsert('url1', 'request_sent', {});
        
        const count = repo.countSentInLast7Days();
        assert.equal(count, 1);
    });

    await t.test('should find all connections with merged data', () => {
        repo.clear();
        repo.upsert('url1', 'request_sent', { name: 'User 1' });
        
        const all = repo.findAllConnections();
        assert.equal(all.length, 1);
        assert.equal(all[0].profile_url, 'url1');
        assert.equal(all[0].name, 'User 1');
        assert.equal(all[0].state, 'request_sent');
    });
});
