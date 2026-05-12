'use client';

import { useQuery } from '@tanstack/react-query';
import { getPulse, getCounters } from '@/lib/api';
import { PulseHeader } from '@/components/dashboard/PulseHeader';
import { MetricGrid } from '@/components/dashboard/MetricGrid';
import { ModuleControls } from '@/components/dashboard/ModuleControls';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { ReviewQueue } from '@/components/dashboard/ReviewQueue';
import { LayoutDashboard, Zap } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardPage() {
  const { data: pulse, isLoading: pulseLoading } = useQuery({
    queryKey: ['pulse'],
    queryFn: getPulse,
    refetchInterval: 3000,
  });

  const { data: counters, isLoading: countersLoading } = useQuery({
    queryKey: ['counters'],
    queryFn: getCounters,
    refetchInterval: 3000,
  });

  const isLoading = pulseLoading || countersLoading;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <LayoutDashboard className="text-primary" size={32} />
            Clean Pulse Supervisor
          </h1>
          <p className="text-muted-foreground mt-1 font-medium">Monitoring autonomous outreach operations.</p>
        </div>
        <div className="flex items-center gap-4 px-4 py-2 bg-card/50 rounded-xl border border-border/50 backdrop-blur-sm shadow-inner">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Supervisor Mode</span>
            <span className="text-sm font-mono font-bold text-primary">v2.1.0-stable</span>
          </div>
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary shadow-sm">
            <Zap size={20} fill="currentColor" />
          </div>
        </div>
      </div>

      {/* Pulse Status */}
      {pulseLoading ? (
        <Skeleton className="h-24 w-full rounded-2xl" />
      ) : (
        <PulseHeader pulse={pulse} />
      )}

      {/* Metrics Grid */}
      {countersLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <MetricGrid counters={counters} />
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-8">
           <ReviewQueue />
           <ActivityFeed />
        </div>

        <div className="space-y-6">
           {pulseLoading ? (
             <Skeleton className="h-[400px] w-full rounded-2xl" />
           ) : (
             <ModuleControls flags={pulse.flags || {}} />
           )}
        </div>
      </div>
    </div>
  );
}
