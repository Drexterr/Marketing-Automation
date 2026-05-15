"use client";

import { useQuery } from '@tanstack/react-query';
import { getAnalytics } from '@/lib/api';
import { Send, UserCheck, MessageSquareReply, Heart, Activity } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export function RuntimeStatsBar() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['analytics-stats'],
    queryFn: getAnalytics,
    refetchInterval: 10000,
  });

  if (error) {
    return (
      <div className="bg-card/50 border border-rose-500/20 rounded-2xl p-4 text-rose-500 text-sm">
        Failed to load stats
      </div>
    );
  }

  const metrics = [
    { label: 'Total Sent', value: stats?.funnel?.sent || 0, icon: Send, color: 'text-blue-400' },
    { label: 'Accepted', value: stats?.funnel?.accepted || 0, icon: UserCheck, color: 'text-emerald-400' },
    { label: 'Replied', value: stats?.funnel?.replied || 0, icon: MessageSquareReply, color: 'text-amber-400' },
    { label: 'Interested', value: stats?.funnel?.interested || 0, icon: Heart, color: 'text-rose-400' },
  ];

  return (
    <div className="bg-card/50 border border-border/50 rounded-2xl p-6 backdrop-blur-sm shadow-sm h-full flex flex-col">
      <div className="flex items-center gap-3 mb-6 border-b border-border/50 pb-4">
        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400 shadow-sm">
          <Activity size={20} />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight">Campaign Analytics</h2>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Global Outreach Funnel</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 flex-1">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))
        ) : (
          metrics.map((m, i) => (
            <div key={i} className="flex flex-col p-4 border border-border/50 rounded-xl bg-slate-900/50">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{m.label}</span>
                <m.icon size={14} className={m.color} />
              </div>
              <span className={`text-2xl font-black ${m.color}`}>{m.value}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
