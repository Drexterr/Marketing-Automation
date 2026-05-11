'use client';

import { useQuery } from '@tanstack/react-query';
import { getAnalytics } from '@/lib/api';
import { StatCard } from '@/components/dashboard/stat-card';
import { AnalyticsCharts } from '@/components/dashboard/analytics-charts';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { ControlPanel } from '@/components/dashboard/ControlPanel';
import { ReviewQueue } from '@/components/dashboard/ReviewQueue';
import { 
  Users, 
  Send, 
  TrendingUp,
  Zap,
  LayoutDashboard
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardPage() {
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['analytics'],
    queryFn: getAnalytics,
  });

  const isLoading = analyticsLoading;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <LayoutDashboard className="text-primary" size={32} />
            System Overview
          </h1>
          <p className="text-muted-foreground mt-1 font-medium">Real-time performance and outreach metrics.</p>
        </div>
        <div className="flex items-center gap-4 px-4 py-2 bg-card/50 rounded-xl border border-border/50 backdrop-blur-sm shadow-inner">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Active session</span>
            <span className="text-sm font-mono font-bold text-primary">cue-ai-prod-01</span>
          </div>
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary shadow-sm">
            <Zap size={20} fill="currentColor" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))
        ) : (
          <>
            <StatCard 
              title="New Connections" 
              value={analytics?.funnel?.sent ?? 0}
              description="sent in total"
              icon={Users}
              trend={{ value: 12, isUp: true }}
              className="bg-card/40 border-primary/10"
            />
            <StatCard 
              title="First Messages" 
              value={analytics?.firstMessagesSent ?? 0}
              description="total outbound"
              icon={Send}
              className="bg-card/40 border-primary/10"
            />
            <StatCard 
              title="Reply Rate" 
              value={`${analytics?.replyRate ?? 0}%`}
              description="average across leads"
              icon={TrendingUp}
              trend={{ value: 3, isUp: true }}
              className="bg-card/40 border-primary/10"
            />
            <StatCard 
              title="Avg Claude Score" 
              value="8.2"
              description="lead quality average"
              icon={Zap}
              className="bg-card/40 border-primary/10"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-8">
           <ReviewQueue />
           
           {isLoading ? (
             <Skeleton className="h-[400px] w-full rounded-xl" />
           ) : (
             <AnalyticsCharts data={analytics} />
           )}
        </div>

        <div className="space-y-6">
           <ControlPanel />
           <ActivityFeed />
        </div>
      </div>
    </div>
  );
}
