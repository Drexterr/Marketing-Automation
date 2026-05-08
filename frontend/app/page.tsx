'use client';

import { useQuery } from '@tanstack/react-query';
import { getSystemState } from '@/lib/api';
import { StatCard } from '@/components/dashboard/stat-card';
import { 
  Users, 
  Send, 
  MessageSquare, 
  TrendingUp,
  Zap,
  Activity,
  History
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function DashboardPage() {
  const { data: state, isLoading } = useQuery({
    queryKey: ['systemState'],
    queryFn: getSystemState,
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">System Overview</h1>
          <p className="text-muted-foreground mt-1">Real-time performance and outreach metrics.</p>
        </div>
        <div className="flex items-center gap-4 px-4 py-2 bg-secondary/50 rounded-xl border border-border">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Active session</span>
            <span className="text-sm font-mono font-bold">cue-ai-prod-01</span>
          </div>
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
            <Zap size={20} fill="currentColor" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="New Connections" 
          value={state?.metrics?.connections_sent ?? 0}
          description="sent this week"
          icon={Users}
          trend={{ value: 12, isUp: true }}
        />
        <StatCard 
          title="First Messages" 
          value={state?.metrics?.messages_sent ?? 0}
          description="total outbound"
          icon={Send}
        />
        <StatCard 
          title="Reply Rate" 
          value="24.5%"
          description="average across all leads"
          icon={TrendingUp}
          trend={{ value: 3, isUp: true }}
        />
        <StatCard 
          title="Avg Claude Score" 
          value="8.2"
          description="lead quality average"
          icon={Zap}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Activity size={18} className="text-primary" />
                Live Automation State
              </CardTitle>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest border border-primary/20">
              Live Sync
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { label: 'Scheduler', status: state?.scheduler || 'idle', time: 'Active since 08:00 AM' },
                { label: 'Connect Module', status: state?.connect_enabled ? 'running' : 'disabled', time: 'Last run 12m ago' },
                { label: 'Message Module', status: state?.first_message_enabled ? 'running' : 'disabled', time: 'Waiting for triggers' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
                  <div className="flex flex-col">
                    <span className="font-bold text-sm">{item.label}</span>
                    <span className="text-xs text-muted-foreground">{item.time}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${item.status === 'running' ? 'bg-green-500 animate-pulse' : 'bg-muted'}`} />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{item.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <History size={18} className="text-primary" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
             <button className="w-full text-left p-3 rounded-lg hover:bg-secondary transition-colors text-sm font-medium border border-transparent hover:border-border">
               Run Connection Check
             </button>
             <button className="w-full text-left p-3 rounded-lg hover:bg-secondary transition-colors text-sm font-medium border border-transparent hover:border-border">
               Manual Reply Sync
             </button>
             <button className="w-full text-left p-3 rounded-lg hover:bg-secondary transition-colors text-sm font-medium border border-transparent hover:border-border">
               Download Activity Log
             </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
