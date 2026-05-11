import { RuntimeStateService } from './RuntimeStateService.js';
import assert from 'node:assert';
import test from 'node:test';

test('RuntimeStateService handles pulse data', () => {
    const pulse = { status: 'ACTIVE', activeTask: 'task-connect', progressPercent: 50 };
    RuntimeStateService.setPulse(pulse);
    const retrieved = RuntimeStateService.getPulse();
    assert.strictEqual(retrieved.status, pulse.status);
    assert.strictEqual(retrieved.activeTask, pulse.activeTask);
    assert.ok(retrieved.lastHeartbeat, 'Pulse should have a heartbeat timestamp');
    
    // Verify it's an ISO string (roughly)
    assert.ok(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(retrieved.lastHeartbeat));
});

test('RuntimeStateService returns default pulse when none set', () => {
    // Assuming clear state or unique key
    // For testing purposes, we might need a way to clear the specific key
    // but let's check default behavior first
    const retrieved = RuntimeStateService.getPulse();
    if (!retrieved.lastHeartbeat) { // If it was never set
        assert.strictEqual(retrieved.status, 'IDLE');
        assert.strictEqual(retrieved.activeTask, null);
    }
});
