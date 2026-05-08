# Design Spec: CUE AI Operational Control Panel - Phase 1 (Backend API & Data Layer)

**Date:** 2026-05-08
**Topic:** Backend API & Data Layer (Phase 1)
**Status:** Draft

## 1. Overview
The CUE AI Outreach System is an existing LinkedIn automation platform using Node.js, Playwright, and NDJSON persistence. Phase 1 focuses on building a modern, production-grade Express.js API, establishing a clean data abstraction layer (Repository pattern), and integrating secure local authentication. This lays the groundwork for the Next.js control panel (Phase 2) without disrupting the existing automation workflows.

## 2. Architecture & Directory Structure
We will adopt an incremental structure to preserve the existing `src/` directory functionality while building out the new components.

- **`/backend-api`**: Contains the Express.js server, routers, controllers, and middleware.
- **`/shared/repositories`**: Contains the Data Access Object (DAO) layer for clean data management.
- **`/src`**: Retains existing Playwright and automation logic (e.g., `scheduler.js`, `task-*.js`).
- **`/data`**: Retains NDJSON/JSON file storage.

## 3. Data Layer Abstraction (Repository Pattern)
To abstract the file system and prepare for a future PostgreSQL migration, we will introduce a standard Repository pattern:

- **`BaseRepository` Interface**: Defines contract methods: `findAll()`, `findById()`, `create()`, `update()`, `delete()`.
- **`JsonRepository`**: Implementation for stateful configuration and toggles (e.g., `system-config.json`, `auth.json`).
- **`NdjsonRepository`**: Implementation for append-only data logs (e.g., `activity.ndjson`, `conversations.ndjson`).

This abstraction ensures that the Express API and automation scripts interact with data objects rather than directly managing `fs.readFileSync` or file streams.

## 4. State Management & API Integration
To achieve real-time monitoring of workflow state (running, idle, sleeping) as required for the dashboard:

- **In-Memory StateManager**: A singleton class loaded at the application root.
- **Unified Process**: The Express server and the Automation Scheduler will be instantiated in the same Node.js process (e.g., via a unified `server.js` or an updated `src/index.js`).
- **Communication**: The automation scripts update the `StateManager`. The `/api/state` endpoint reads from the `StateManager` to serve the frontend.

## 5. Security & Authentication
The operational dashboard must be secure and locally authenticated.

- **Storage**: A configurable, hashed admin password stored in `data/auth.json`.
- **First Launch**: If `auth.json` is missing, the API accepts a setup request to create the password.
- **Session/Token**: Express middleware using JWT or secure session cookies to protect all `/api/*` endpoints.
- **Protection**: CSRF protection and rate limiting implemented via Express middleware.

## 6. Testing & Validation
- Unit tests for the Repository classes to ensure valid NDJSON/JSON formatting.
- Integration tests for the Express endpoints ensuring unauthorized access is rejected.
- Manual verification that starting the backend properly mounts the scheduler and serves the API concurrently.
