'use client';

import { useQuery } from '@tanstack/react-query';
import { getSystemState, getAnalytics, getActivity } from '@/lib/api';
import { StatCard } from '@/components/dashboard/stat-card';
import { AnalyticsCharts } from '@/components/dashboard/analytics-charts';
import { ActivityFeed } from '@/components/dashboard/activity-feed';
import { 
  Users, 
  Send, 
  MessageSquare, 
  TrendingUp,
  Zap,
  Activity,
  History,
  LayoutDashboard
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardPage() {
  const { data: state, isLoading: stateLoading } = useQuery({
    queryKey: ['systemState'],
    queryFn: getSystemState,
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['analytics'],
    queryFn: getAnalytics,
  });

  const { data: activity, isLoading: activityLoading } = useQuery({
    queryKey: ['activity'],
    queryFn: getActivity,
  });

  const isLoading = stateLoading || analyticsLoading || activityLoading;

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
           {isLoading ? (
             <Skeleton className="h-[400px] w-full rounded-xl" />
           ) : (
             <AnalyticsCharts data={analytics} />
           )}

           <Card className="bg-card/30 border-dashed">
             <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Activity size={18} className="text-primary" />
                  Live Workflow State
                </CardTitle>
             </CardHeader>
             <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { label: 'Scheduler', status: state?.scheduler || 'idle' },
                    { label: 'Connect', status: state?.connect_enabled ? 'running' : 'disabled' },
                    { label: 'Messaging', status: state?.first_message_enabled ? 'running' : 'disabled' },
                  ].map((item) => (
                    <div key={item.label} className="p-4 rounded-xl bg-secondary/20 border border-border/50 flex flex-col items-center justify-center text-center">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{item.label}</span>
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${item.status === 'running' ? 'bg-green-500 animate-pulse' : 'bg-muted'}`} />
                        <span className="text-xs font-black uppercase tracking-tighter">{item.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
             </CardContent>
           </Card>
        </div>

        <div className="space-y-6">
           <Card className="bg-card/40 border-primary/5">
             <CardContent className="pt-6">
                {isLoading ? (
                  <div className="space-y-4">
                    Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))
                  </div>
                ) : (
                  <ActivityFeed activities={activity || []} />
                )}
             </CardContent>
           </Card>

           <Card className="bg-card/40 border-primary/5">
             <CardHeader>
               <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest text-muted-foreground">
                 <History size={16} />
                 Quick Actions
               </CardTitle>
             </CardHeader>
             <CardContent className="space-y-2">
                <button className="w-full text-left p-3 rounded-lg hover:bg-primary/10 hover:text-primary transition-all text-xs font-bold border border-transparent hover:border-primary/20">
                  RUN CONNECTION CHECK
                </button>
                <button className="w-full text-left p-3 rounded-lg hover:bg-primary/10 hover:text-primary transition-all text-xs font-bold border border-transparent hover:border-primary/20">
                  MANUAL REPLY SYNC
                </button>
                <button className="w-full text-left p-3 rounded-lg hover:bg-primary/10 hover:text-primary transition-all text-xs font-bold border border-transparent hover:border-primary/20">
                  DOWNLOAD AUDIT LOG
                </button>
             </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}
