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
    { label: 'Requests Sent',   value: stats?.funnel?.sent      || 0, icon: Send,               color: 'text-blue-400' },
    { label: 'Accepted',        value: stats?.funnel?.accepted  || 0, icon: UserCheck,           color: 'text-emerald-400' },
    { label: 'Replied',         value: stats?.funnel?.replied   || 0, icon: MessageSquareReply,  color: 'text-amber-400' },
    { label: 'Interested',      value: stats?.funnel?.interested|| 0, icon: Heart,               color: 'text-rose-400' },
    { label: 'Comments',        value: stats?.comments          || 0, icon: Activity,            color: 'text-violet-400' },
    { label: 'Replies Sent',    value: stats?.repliesSent       || 0, icon: MessageSquareReply,  color: 'text-sky-400' },
    { label: 'First Messages',  value: stats?.firstMessages     || 0, icon: Send,                color: 'text-teal-400' },
  ];

  return (
    <div className="bg-card/50 border border-border/50 rounded-2xl p-6 backdrop-blur-sm shadow-sm h-full flex flex-col">
      <div className="flex items-center gap-3 mb-4 border-b border-border/50 pb-4">
        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400 shadow-sm">
          <Activity size={20} />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight">Campaign Analytics</h2>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Global Outreach Funnel</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {isLoading ? (
          Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))
        ) : (
          metrics.map((m, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2.5 border border-border/50 rounded-lg bg-slate-900/50">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider leading-none">{m.label}</span>
                <span className={`text-lg font-black leading-none ${m.color}`}>{m.value}</span>
              </div>
              <m.icon size={14} className={`${m.color} opacity-60`} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
