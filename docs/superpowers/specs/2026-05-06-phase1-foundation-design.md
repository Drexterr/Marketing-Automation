# Design Spec: LinkedIn Automation - Phase 1 Foundation

**Date:** 2026-05-06
**Topic:** Foundation & Setup
**Status:** Draft

## 1. Overview
Establish a robust, modular foundation for a LinkedIn automation tool using Playwright and Claude AI. Phase 1 focuses on browser persistence, manual login flow, logging, and API connectivity.

## 2. Architecture
The system follows an instance-based (OOP) approach for browser management and a functional approach for the AI service.

### 2.1 Component Diagram
- **CLI (index.js):** Orchestrates commands (e.g., `setup`).
- **BrowserManager (browser.js):** Manages Playwright lifetime, contexts, and session persistence.
- **ClaudeService (claude-service.js):** Handles communication with Anthropic's API.
- **Logger (utils/logger.js):** Provides timestamped file-based and console logging.

### 2.2 Data Flow
1. User runs `npm run setup`.
2. `index.js` initializes `BrowserManager` and `ClaudeService`.
3. `BrowserManager.launch()` starts Chromium (non-headless by default for setup).
4. `index.js` navigates to LinkedIn and waits for user to log in manually.
5. Detection: Wait for `#global-nav` or equivalent element.
6. `BrowserManager.saveSession()` writes cookies/storage state to `data/session.json`.
7. `ClaudeService.testConnection()` validates the API key.
8. Logs recorded in `logs/automation.log`.

## 3. Component Details

### 3.1 BrowserManager (`src/browser.js`)
- **Properties:** `browser`, `context`, `page`.
- **Method `launch(options)`:** Launches Chromium with basic anti-detection (User-Agent rotation, etc.).
- **Method `initContext()`:** Loads `data/session.json` if it exists.
- **Method `saveSession(path)`:** Captures state using `context.storageState()`.

### 3.2 ClaudeService (`src/claude-service.js`)
- **Function `testClaudeConnection()`:** Sends a "Hello" prompt to Claude 3.5 Sonnet to verify the API key.

### 3.3 CLI (`src/index.js`)
- Uses `commander` or simple `process.argv` to handle the `setup` command.
- Orchestrates the login wait loop.

## 4. Testing & Validation
- **Manual Verification:** Verify `data/session.json` is created after login.
- **Log Check:** Ensure `logs/automation.log` contains initialization and success entries.
- **API Check:** Ensure `testClaudeConnection` returns a valid string.

## 5. Constraints & Safety
- **Anti-Detection:** Basic human-like behavior (SlowMo).
- **Security:** `.env` and `data/` excluded from Git via `.gitignore`.
- **Persistence:** Use `storageState` for session persistence.
