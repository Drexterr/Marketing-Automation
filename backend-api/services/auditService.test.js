import { test } from 'node:test';
import assert from 'node:assert/strict';
import { logAudit } from './auditService.js';
import { ActivityRepository } from '../../shared/repositories/ActivityRepository.js';
import fs from 'fs';
import path from 'path';

test('logAudit logs to both repositories', async () => {
  const activityRepo = new ActivityRepository();
  activityRepo.clear();

  const action = 'TEST_ACTION';
  const details = { foo: 'bar' };

  await logAudit(action, details);

  // Check SQLite
  const recent = activityRepo.getRecent(1);
  assert.equal(recent.length, 1);
  assert.equal(recent[0].event_type, action);
  assert.equal(recent[0].module, 'audit');
  assert.equal(recent[0].details, JSON.stringify(details));

  // Check NDJSON (optional, but good for completeness)
  const auditPath = path.join('data', 'audit.ndjson');
  if (fs.existsSync(auditPath)) {
    const content = fs.readFileSync(auditPath, 'utf8');
    const lines = content.trim().split('\n');
    const lastLine = JSON.parse(lines[lines.length - 1]);
    assert.equal(lastLine.action, action);
    assert.deepEqual(lastLine.details, details);
  }
});
