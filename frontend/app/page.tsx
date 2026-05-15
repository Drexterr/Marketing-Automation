'use client';

import { useQuery } from '@tanstack/react-query';
import { WorkflowControlCenter } from '@/components/dashboard/WorkflowControlCenter';
import { RuntimeStatsBar } from '@/components/dashboard/RuntimeStatsBar';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { ReviewQueue } from '@/components/dashboard/ReviewQueue';
import { LayoutDashboard, Zap } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <LayoutDashboard className="text-primary" size={32} />
            CUE AI Operational Console
          </h1>
          <p className="text-muted-foreground mt-1 font-medium">Founder-grade automation monitoring and control.</p>
        </div>
        <div className="flex items-center gap-4 px-4 py-2 bg-card/50 rounded-xl border border-border/50 backdrop-blur-sm shadow-inner">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Supervisor Mode</span>
            <span className="text-sm font-mono font-bold text-primary">v3.0.0-operational</span>
          </div>
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary shadow-sm">
            <Zap size={20} fill="currentColor" />
          </div>
        </div>
      </div>

      {/* Main Content Grid: 3 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Diagnostics & Feeds */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          <ActivityFeed />
        </div>

        {/* Middle Column: Workflow Control */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          <WorkflowControlCenter />
        </div>

        {/* Right Column: Analytics */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          <RuntimeStatsBar />
        </div>

      </div>

      {/* Full width bottom row */}
      <div className="w-full">
        <ReviewQueue />
      </div>
    </div>
  );
}
