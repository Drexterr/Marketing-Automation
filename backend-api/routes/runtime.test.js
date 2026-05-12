import test from 'node:test';
import assert from 'node:assert';
import express from 'express';
import { createServer } from '../server.js';
import { activeTokens } from '../middleware/auth.js';
import { RuntimeStateService } from '../services/RuntimeStateService.js';

import runtimeRouter from './runtime.js';

test('GET /api/runtime/pulse returns pulse data', async (t) => {
    const app = createServer();
    const token = 'test-token-pulse';
    activeTokens.set(token, Date.now() + 3600000);

    // We can test the router directly to avoid HTTP overhead since supertest is missing
    const req = { };
    const res = {
        json: (data) => {
            assert.ok(data.status, 'Pulse should have a status');
            return res;
        },
        status: (code) => {
            assert.strictEqual(code, 200);
            return res;
        }
    };

    // Find the route handler
    const route = runtimeRouter.stack.find(s => s.route && s.route.path === '/pulse');
    assert.ok(route, 'Pulse route should exist');
    route.route.stack[0].handle(req, res);
});

test('GET /api/runtime/counters returns counter data', async (t) => {
    const app = createServer();
    const token = 'test-token-counters';
    activeTokens.set(token, Date.now() + 3600000);

    const req = { };
    const res = {
        json: (data) => {
            assert.ok(typeof data.weeklyConnections === 'number', 'Weekly connections should be a number');
            assert.strictEqual(data.dailyReplies, 0);
            return res;
        },
        status: (code) => {
            assert.strictEqual(code, 200);
            return res;
        }
    };

    const route = runtimeRouter.stack.find(s => s.route && s.route.path === '/counters');
    assert.ok(route, 'Counters route should exist');
    route.route.stack[0].handle(req, res);
});

test('POST /api/runtime/modules/stop triggers emergency stop', async (t) => {
    const req = { };
    let jsonCalled = false;
    const res = {
        json: (data) => {
            assert.strictEqual(data.success, true);
            jsonCalled = true;
            return res;
        }
    };

    const route = runtimeRouter.stack.find(s => s.route && s.route.path === '/modules/stop');
    assert.ok(route, 'Stop route should exist');
    
    route.route.stack[0].handle(req, res);
    assert.ok(jsonCalled, 'res.json should have been called');
});

test('POST /api/runtime/modules/toggle/:module sets module state', async (t) => {
    const req = { 
        params: { module: 'test_module' },
        body: { enabled: true }
    };
    let jsonCalled = false;
    const res = {
        json: (data) => {
            assert.strictEqual(data.success, true);
            jsonCalled = true;
            return res;
        }
    };

    const route = runtimeRouter.stack.find(s => s.route && s.route.path === '/modules/toggle/:module');
    assert.ok(route, 'Toggle route should exist');
    
    route.route.stack[0].handle(req, res);
    assert.ok(jsonCalled, 'res.json should have been called');
});

test('POST /api/runtime/modules/stop actually sets emergency_stop flag', async (t) => {
    const req = { };
    const res = { json: () => res };
    
    const route = runtimeRouter.stack.find(s => s.route && s.route.path === '/modules/stop');
    route.route.stack[0].handle(req, res);
    
    assert.strictEqual(RuntimeStateService.getFlag('emergency_stop'), true, 'emergency_stop flag should be true');
});

test('POST /api/runtime/modules/toggle/:module actually sets module flag', async (t) => {
    const moduleName = 'test_toggle_side_effect';
    const req = { 
        params: { module: moduleName },
        body: { enabled: false }
    };
    const res = { json: () => res };
    
    const route = runtimeRouter.stack.find(s => s.route && s.route.path === '/modules/toggle/:module');
    route.route.stack[0].handle(req, res);
    
    assert.strictEqual(RuntimeStateService.getFlag(`${moduleName}_enabled`), false, 'module enabled flag should be false');
});
