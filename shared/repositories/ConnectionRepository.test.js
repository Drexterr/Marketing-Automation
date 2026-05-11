import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConnectionRepository } from './ConnectionRepository.js';

test('ConnectionRepository operations', async (t) => {
    const repo = new ConnectionRepository();

    await t.test('should upsert and find by profile url', () => {
        repo.clear();
        const profileUrl = 'https://www.linkedin.com/in/testuser/';
        const data = { note: 'Hello' };
        
        repo.upsert(profileUrl, 'sent', 'connect', data);
        
        const found = repo.findByProfileUrl(profileUrl);
        assert.ok(found);
        assert.equal(found.profile_url, profileUrl);
        assert.equal(found.status, 'sent');
        assert.equal(JSON.parse(found.data).note, 'Hello');
        
        // Update
        repo.upsert(profileUrl, 'accepted', 'message', { ...data, replied: true });
        const updated = repo.findByProfileUrl(profileUrl);
        assert.equal(updated.status, 'accepted');
        assert.equal(JSON.parse(updated.data).replied, true);
    });

    await t.test('should count sent today', () => {
        repo.clear();
        repo.upsert('url1', 'sent', 'connect', {});
        repo.upsert('url2', 'accepted', 'connect', {});
        repo.upsert('url3', 'pending', 'connect', {});
        
        const count = repo.countSentToday();
        assert.equal(count, 2); // sent or accepted
    });

    await t.test('should count sent in last 7 days', () => {
        repo.clear();
        repo.upsert('url1', 'sent', 'connect', {});
        
        const count = repo.countSentInLast7Days();
        assert.equal(count, 1);
    });

    await t.test('should find all connections with merged data', () => {
        repo.clear();
        repo.upsert('url1', 'sent', 'connect', { name: 'User 1' });
        
        const all = repo.findAllConnections();
        assert.equal(all.length, 1);
        assert.equal(all[0].profile_url, 'url1');
        assert.equal(all[0].name, 'User 1');
    });
});
