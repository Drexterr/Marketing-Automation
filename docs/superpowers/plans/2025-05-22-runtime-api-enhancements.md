# Phase B: Runtime API Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add stop and module toggle endpoints to the backend API's runtime routes.

**Architecture:** Extend existing Express router in `backend-api/routes/runtime.js` to handle module control via `RuntimeStateService`.

**Tech Stack:** Node.js, Express, `node:test`.

---

### Task 1: Add Emergency Stop Endpoint

**Files:**
- Modify: `backend-api/routes/runtime.js`
- Test: `backend-api/routes/runtime.test.js`

- [ ] **Step 1: Write failing test for POST /modules/stop**

```javascript
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
    
    // We'll verify side effects in RuntimeStateService in Step 3
    route.route.stack[0].handle(req, res);
    assert.ok(jsonCalled, 'res.json should have been called');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test backend-api/routes/runtime.test.js`
Expected: FAIL (route not found)

- [ ] **Step 3: Implement POST /modules/stop**

```javascript
router.post('/modules/stop', (req, res) => {
    RuntimeStateService.emergencyStop();
    RuntimeStateService.setPulse({ status: 'STOPPED', activeTask: 'Emergency Stop Triggered' });
    res.json({ success: true });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test backend-api/routes/runtime.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

### Task 2: Add Module Toggle Endpoint

**Files:**
- Modify: `backend-api/routes/runtime.js`
- Test: `backend-api/routes/runtime.test.js`

- [ ] **Step 1: Write failing test for POST /modules/toggle/:module**

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test backend-api/routes/runtime.test.js`
Expected: FAIL (route not found)

- [ ] **Step 3: Implement POST /modules/toggle/:module**

```javascript
router.post('/modules/toggle/:module', (req, res) => {
    const { module } = req.params;
    const { enabled } = req.body;
    RuntimeStateService.setFlag(`${module}_enabled`, enabled);
    res.json({ success: true });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test backend-api/routes/runtime.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

### Task 3: Final Verification and Cleanup

- [ ] **Step 1: Run all backend tests**

Run: `npm test`
Expected: ALL PASS

- [ ] **Step 2: Verify side effects in RuntimeStateService via test**

Add a test case that ensures the flags are actually set.
