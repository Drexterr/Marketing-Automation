# Phase 2: Core Control UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the frontend dashboard using Next.js 15, Tailwind CSS, and shadcn/ui to monitor and control the CUE AI automation workflows.

**Architecture:** Next.js App Router for the frontend, persistent Sidebar layout with a global status pulse, React Query for API synchronization, and a modular "Automation" page for feature toggles.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Lucide React, React Query (TanStack Query).

---

### Task 1: Next.js Frontend Setup

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/next.config.js`
- Create: `frontend/src/app/layout.tsx`
- Create: `frontend/src/app/page.tsx`

- [ ] **Step 1: Initialize Next.js in /frontend**
Run: `npx create-next-app@latest frontend --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"`
(Note: If prompted, select defaults. We'll clean up afterwards).

- [ ] **Step 2: Install additional dependencies**
Run: `cd frontend && npm install lucide-react @tanstack/react-query @tanstack/react-query-devtools axios clsx tailwind-merge`

- [ ] **Step 3: Initialize shadcn/ui**
Run: `cd frontend && npx shadcn-ui@latest init`
(Select: Slate, Default, Yes to CSS variables).

- [ ] **Step 4: Commit setup**
```bash
git add frontend/
git commit -m "chore: initial Next.js and shadcn/ui setup"
```

---

### Task 2: Core Layout & Sidebar

**Files:**
- Create: `frontend/components/layout/sidebar.tsx`
- Create: `frontend/components/layout/status-indicator.tsx`
- Modify: `frontend/app/layout.tsx`

- [ ] **Step 1: Implement StatusIndicator component**
```tsx
// frontend/components/layout/status-indicator.tsx
export function StatusIndicator({ status }: { status: string }) {
  const colors: Record<string, string> = {
    running: 'bg-green-500',
    idle: 'bg-yellow-500',
    sleeping: 'bg-blue-500',
    error: 'bg-red-500',
  };

  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-secondary/50">
      <div className={`h-2 w-2 rounded-full animate-pulse ${colors[status] || 'bg-gray-500'}`} />
      <span className="text-xs font-medium uppercase tracking-wider">{status}</span>
    </div>
  );
}
```

- [ ] **Step 2: Implement Sidebar component**
```tsx
// frontend/components/layout/sidebar.tsx
import Link from 'next/link';
import { LayoutDashboard, Settings, MessageSquare, BarChart3, Power } from 'lucide-react';
import { StatusIndicator } from './status-indicator';

export function Sidebar() {
  return (
    <aside className="w-64 border-r bg-card flex flex-col h-screen">
      <div className="p-6 font-bold text-xl border-bottom">CUE AI</div>
      <nav className="flex-1 p-4 space-y-2">
        <Link href="/" className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary"><LayoutDashboard size={20}/> Dashboard</Link>
        <Link href="/automation" className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary"><Settings size={20}/> Automation</Link>
        <Link href="/inbox" className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary"><MessageSquare size={20}/> Inbox</Link>
      </nav>
      <div className="p-4 border-t space-y-4">
        <StatusIndicator status="running" />
        <button className="w-full flex items-center justify-center gap-2 bg-destructive text-destructive-foreground p-2 rounded-lg font-bold hover:bg-destructive/90">
          <Power size={20} /> EMERGENCY STOP
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Update root layout**
```tsx
// frontend/app/layout.tsx
import { Sidebar } from '@/components/layout/sidebar';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="flex">
        <Sidebar />
        <main className="flex-1 h-screen overflow-auto bg-background p-8">
          {children}
        </main>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Commit layout**
```bash
git add frontend/components/ frontend/app/layout.tsx
git commit -m "feat: add sidebar layout with global status and emergency stop"
```

---

### Task 3: API Client & React Query Setup

**Files:**
- Create: `frontend/lib/api.ts`
- Create: `frontend/components/providers/query-provider.tsx`
- Modify: `frontend/app/layout.tsx`

- [ ] **Step 1: Create API client**
```tsx
// frontend/lib/api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
});

export const getSystemState = async () => {
  const { data } = await api.get('/state');
  return data;
};

export const toggleModule = async (module: string, enabled: boolean) => {
  const { data } = await api.post(`/toggle/${module}`, { enabled });
  return data;
};

export const emergencyStop = async () => {
  const { data } = await api.post('/stop');
  return data;
};
```

- [ ] **Step 2: Setup React Query Provider**
```tsx
// frontend/components/providers/query-provider.tsx
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 3: Wrap layout with Provider**
```tsx
// Modify frontend/app/layout.tsx to include <QueryProvider> around {children}
```

- [ ] **Step 4: Commit**
```bash
git add frontend/lib/api.ts frontend/components/providers/
git commit -m "feat: setup API client and React Query provider"
```

---

### Task 4: Automation Control Page

**Files:**
- Create: `frontend/app/automation/page.tsx`
- Create: `frontend/components/automation/module-toggle.tsx`

- [ ] **Step 1: Implement ModuleToggle component**
```tsx
// Use shadcn/ui Switch and Card
```

- [ ] **Step 2: Build Automation Page**
```tsx
// List all toggles (Connect, Messaging, etc.)
// Sync with backend using useMutation from React Query
```

- [ ] **Step 3: Commit**
```bash
git add frontend/app/automation/
git commit -m "feat: implement automation module control page"
```

---

### Task 5: Dashboard Overview

**Files:**
- Create: `frontend/app/page.tsx`
- Create: `frontend/components/dashboard/stat-card.tsx`

- [ ] **Step 1: Implement StatCard component**
- [ ] **Step 2: Build Dashboard home page**
```tsx
// Show cards for active status, metrics, and safety alerts
```

- [ ] **Step 3: Commit**
```bash
git add frontend/app/page.tsx frontend/components/dashboard/
git commit -m "feat: implement dashboard overview page"
```
