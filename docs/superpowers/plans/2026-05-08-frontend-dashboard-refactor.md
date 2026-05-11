# Frontend Dashboard Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the frontend into a real operational dashboard with modular controls, live activity polling, and a review queue for human-in-the-loop validation.

**Architecture:** Component-based architecture using React functional components. Data management handled by TanStack Query for caching, background polling, and optimistic updates. UI built with shadcn/ui primitives and Tailwind CSS for a modern, high-density dashboard feel.

**Tech Stack:** Next.js (React), TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Axios, Lucide React.

---

### Task 1: Update API Client

**Files:**
- Modify: `.worktrees/orchestration-refactor/frontend/lib/api.ts`

- [ ] **Step 1: Add new methods to `api.ts`**

Add `getReviewQueue` and `updateReviewItem` to the existing API client.

```typescript
export const getReviewQueue = async () => {
  const { data } = await api.get('/review-queue');
  return data;
};

export const updateReviewItem = async (id: string, status: string, response?: string) => {
  const { data } = await api.post(`/review-queue/${id}`, { status, response });
  return data;
};
```

- [ ] **Step 2: Commit API changes**

```bash
git add .worktrees/orchestration-refactor/frontend/lib/api.ts
git commit -m "feat(api): add review queue methods"
```

---

### Task 2: Create ControlPanel Component

**Files:**
- Create: `.worktrees/orchestration-refactor/frontend/components/dashboard/ControlPanel.tsx`

- [ ] **Step 1: Implement ControlPanel with module toggles and Emergency Stop**

```tsx
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSystemState, toggleModule, emergencyStop } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Zap, ShieldAlert } from 'lucide-react';

export function ControlPanel() {
  const queryClient = useQueryClient();
  const { data: state } = useQuery({
    queryKey: ['systemState'],
    queryFn: getSystemState,
    refetchInterval: 5000,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ module, enabled }: { module: string; enabled: boolean }) => 
      toggleModule(module, enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['systemState'] }),
  });

  const stopMutation = useMutation({
    mutationFn: emergencyStop,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['systemState'] }),
  });

  const modules = [
    { id: 'connect_enabled', label: 'Connection Engine' },
    { id: 'first_message_enabled', label: 'Outreach Engine' },
    { id: 'feed_enabled', label: 'Feed Monitor' },
  ];

  return (
    <Card className="bg-card/40 border-primary/10">
      <CardHeader>
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Zap size={18} className="text-primary" />
          System Controls
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {modules.map((mod) => (
            <div key={mod.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 border border-border/50">
              <Label htmlFor={mod.id} className="text-sm font-medium">{mod.label}</Label>
              <Switch 
                id={mod.id} 
                checked={!!state?.[mod.id]} 
                onCheckedChange={(checked) => toggleMutation.mutate({ module: mod.id, enabled: checked })}
              />
            </div>
          ))}
        </div>
        
        <Button 
          variant="destructive" 
          className="w-full font-bold h-12 gap-2 shadow-lg shadow-destructive/20"
          onClick={() => stopMutation.mutate()}
          disabled={stopMutation.isPending}
        >
          <ShieldAlert size={20} />
          EMERGENCY STOP
        </Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit ControlPanel**

```bash
git add .worktrees/orchestration-refactor/frontend/components/dashboard/ControlPanel.tsx
git commit -m "feat(dashboard): add ControlPanel component"
```

---

### Task 3: Create ActivityFeed Component (polling version)

**Files:**
- Create: `.worktrees/orchestration-refactor/frontend/components/dashboard/ActivityFeed.tsx`

- [ ] **Step 1: Implement ActivityFeed with polling**

```tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { getActivity } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function ActivityFeed() {
  const { data: activities = [] } = useQuery({
    queryKey: ['activity'],
    queryFn: getActivity,
    refetchInterval: 5000,
  });

  return (
    <Card className="h-full bg-card/40 border-primary/5">
      <CardHeader className="pb-4 flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Clock size={18} className="text-primary" />
          Live Activity
        </CardTitle>
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Polling Every 5s</span>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 max-h-[500px] overflow-auto pr-2 custom-scrollbar">        
          {activities.length === 0 ? (
            <div className="text-center py-12 bg-secondary/20 rounded-xl border border-dashed">
               <p className="text-sm text-muted-foreground">No recent activity.</p> 
            </div>
          ) : (
            activities.map((item: any, index: number) => (
              <div key={index} className="flex gap-4 group">
                <div className="flex-1 pb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold tracking-tight">{item.action}</span>
                    <span className="text-[10px] text-muted-foreground font-medium">       
                      {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })} 
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.profile || item.details?.description}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit ActivityFeed**

```bash
git add .worktrees/orchestration-refactor/frontend/components/dashboard/ActivityFeed.tsx
git commit -m "feat(dashboard): add polling ActivityFeed component"
```

---

### Task 4: Create ReviewQueue Component

**Files:**
- Create: `.worktrees/orchestration-refactor/frontend/components/dashboard/ReviewQueue.tsx`

- [ ] **Step 1: Implement ReviewQueue with approval/rejection logic**

```tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getReviewQueue, updateReviewItem } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Check, X } from 'lucide-react';

export function ReviewQueue() {
  const queryClient = useQueryClient();
  const [responses, setResponses] = useState<Record<string, string>>({});

  const { data: queue = [] } = useQuery({
    queryKey: ['reviewQueue'],
    queryFn: getReviewQueue,
    refetchInterval: 10000,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status, response }: { id: string; status: string; response?: string }) => 
      updateReviewItem(id, status, response),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reviewQueue'] }),
  });

  if (queue.length === 0) return null;

  return (
    <Card className="bg-card/40 border-amber-500/20">
      <CardHeader>
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <MessageSquare size={18} className="text-amber-500" />
          Review Queue ({queue.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {queue.map((item: any) => (
          <div key={item.id} className="p-4 rounded-xl bg-secondary/30 border border-border/50 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase">{item.type}</p>
                <p className="text-sm font-bold">{item.profile_name}</p>
              </div>
              <span className="text-[10px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full font-bold">AWAITING REVIEW</span>
            </div>
            
            <div className="bg-background/50 p-3 rounded-lg border text-sm italic">
              "{item.draft_content}"
            </div>

            <Textarea 
              placeholder="Edit response before sending..."
              className="bg-background/50 text-sm"
              value={responses[item.id] ?? item.draft_content}
              onChange={(e) => setResponses({ ...responses, [item.id]: e.target.value })}
            />

            <div className="flex gap-2">
              <Button 
                size="sm" 
                className="flex-1 bg-green-600 hover:bg-green-700 h-9 gap-2"
                onClick={() => reviewMutation.mutate({ id: item.id, status: 'approved', response: responses[item.id] })}
              >
                <Check size={16} /> Approve
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="flex-1 h-9 gap-2"
                onClick={() => reviewMutation.mutate({ id: item.id, status: 'rejected' })}
              >
                <X size={16} /> Reject
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit ReviewQueue**

```bash
git add .worktrees/orchestration-refactor/frontend/components/dashboard/ReviewQueue.tsx
git commit -m "feat(dashboard): add ReviewQueue component"
```

---

### Task 5: Integrate into Page

**Files:**
- Modify: `.worktrees/orchestration-refactor/frontend/app/page.tsx`

- [ ] **Step 1: Replace hardcoded sections with new components**

```tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { getAnalytics } from '@/lib/api';
import { StatCard } from '@/components/dashboard/stat-card';
import { AnalyticsCharts } from '@/components/dashboard/analytics-charts';
import { ControlPanel } from '@/components/dashboard/ControlPanel';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { ReviewQueue } from '@/components/dashboard/ReviewQueue';
import { Users, Send, TrendingUp, Zap, LayoutDashboard } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardPage() {
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['analytics'],
    queryFn: getAnalytics,
    refetchInterval: 30000,
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">        
            <LayoutDashboard className="text-primary" size={32} />
            Operations Center
          </h1>
          <p className="text-muted-foreground mt-1 font-medium">Orchestration control and real-time execution monitoring.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {analyticsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))
        ) : (
          <>
            <StatCard title="Total Outreach" value={analytics?.funnel?.sent ?? 0} icon={Users} />
            <StatCard title="Active Leads" value={analytics?.funnel?.connected ?? 0} icon={Send} />
            <StatCard title="Conversion Rate" value={`${analytics?.replyRate ?? 0}%`} icon={TrendingUp} />
            <StatCard title="System Health" value="OPTIMAL" icon={Zap} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-8">
           <AnalyticsCharts data={analytics} />
           <ReviewQueue />
        </div>

        <div className="space-y-6">
           <ControlPanel />
           <ActivityFeed />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit final dashboard integration**

```bash
git add .worktrees/orchestration-refactor/frontend/app/page.tsx
git commit -m "feat(dashboard): integrate operational components into main page"
```

---
