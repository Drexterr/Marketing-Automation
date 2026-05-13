import { RuntimeStateService } from './RuntimeStateService.js';
import { RuntimeStateRepository } from '../../shared/repositories/RuntimeStateRepository.js';
import assert from 'node:assert';
import test, { describe, it } from 'node:test';
import { setTimeout } from 'node:timers/promises';

const repo = new RuntimeStateRepository();

describe('Unified State Machine', () => {
  it('prevents invalid state transitions', () => {
    // Reset state first
    repo.set('workflow_state', 'IDLE');
    assert.throws(() => RuntimeStateService.setWorkflowState('PAUSED'), /Invalid transition/);
  });
});

test('RuntimeStateService handles pulse data', () => {
    // Force immediate write via 0% progress to ensure it's written regardless of throttle
    const pulse = { status: 'ACTIVE', activeTask: 'task-connect', progressPercent: 0 };
    RuntimeStateService.setPulse(pulse);
    const retrieved = RuntimeStateService.getPulse();
    assert.strictEqual(retrieved.status, pulse.status);
    assert.strictEqual(retrieved.activeTask, pulse.activeTask);
    assert.ok(retrieved.lastHeartbeat, 'Pulse should have a heartbeat timestamp');
    
    // Verify it's an ISO string (roughly)
    assert.ok(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(retrieved.lastHeartbeat));
});

test('RuntimeStateService returns default pulse when none set', () => {
    // Clear state for this test
    repo.set('runtime_pulse', null);
    const retrieved = RuntimeStateService.getPulse();
    assert.strictEqual(retrieved.status, 'IDLE');
    assert.strictEqual(retrieved.activeTask, null);
});

test('RuntimeStateService pulse optimization', async (t) => {
    // Clear initial state
    repo.set('runtime_pulse', null);

    await t.test('immediately writes 0% progress', async () => {
        const pulse = { status: 'ACTIVE', activeTask: 'task-1', progressPercent: 0 };
        RuntimeStateService.setPulse(pulse);
        const retrieved = RuntimeStateService.getPulse();
        assert.strictEqual(retrieved.progressPercent, 0);
    });

    await t.test('immediately writes 100% progress', async () => {
        const pulse = { status: 'ACTIVE', activeTask: 'task-1', progressPercent: 100 };
        RuntimeStateService.setPulse(pulse);
        const retrieved = RuntimeStateService.getPulse();
        assert.strictEqual(retrieved.progressPercent, 100);
    });

    await t.test('immediately writes on status change', async () => {
        // Set initial status to ACTIVE
        RuntimeStateService.setPulse({ status: 'ACTIVE', progressPercent: 1 });
        
        // Change to IDLE
        const pulse = { status: 'IDLE', progressPercent: 1 };
        RuntimeStateService.setPulse(pulse);
        const retrieved = RuntimeStateService.getPulse();
        assert.strictEqual(retrieved.status, 'IDLE');
    });

    await t.test('debounces intermediate updates', async () => {
        // Reset to ACTIVE, 0% (immediate)
        RuntimeStateService.setPulse({ status: 'ACTIVE', progressPercent: 0 });
        
        // Intermediate update (should be debounced)
        const pulse1 = { status: 'ACTIVE', progressPercent: 10 };
        RuntimeStateService.setPulse(pulse1);
        
        const retrieved1 = RuntimeStateService.getPulse();
        assert.notStrictEqual(retrieved1.progressPercent, 10, 'Intermediate update should be debounced');

        // Wait for debounce (THROTTLE_MS is 2000)
        await setTimeout(2100);
        
        const retrieved2 = RuntimeStateService.getPulse();
        assert.strictEqual(retrieved2.progressPercent, 10, 'Intermediate update should be flushed after debounce');
    });

    await t.test('consecutive intermediate updates reset debounce timer', async () => {
        // Reset to ACTIVE, 0% (immediate)
        RuntimeStateService.setPulse({ status: 'ACTIVE', progressPercent: 0 });
        
        // First intermediate update
        RuntimeStateService.setPulse({ status: 'ACTIVE', progressPercent: 15 });
        
        // Wait 1s (less than 2s throttle)
        await setTimeout(1000);
        
        // Second intermediate update (should reset timer)
        RuntimeStateService.setPulse({ status: 'ACTIVE', progressPercent: 25 });
        
        // Wait another 1.5s (total 2.5s since first update, but only 1.5s since second)
        await setTimeout(1500);
        
        const retrieved1 = RuntimeStateService.getPulse();
        assert.notStrictEqual(retrieved1.progressPercent, 25, 'Second update should not have flushed yet');

        // Wait another 1s (total 2.5s since second update)
        await setTimeout(1000);
        
        const retrieved2 = RuntimeStateService.getPulse();
        assert.strictEqual(retrieved2.progressPercent, 25, 'Second update should be flushed after full debounce');
    });
});
