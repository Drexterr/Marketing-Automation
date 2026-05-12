'use client';

import React from 'react';
import { ShieldAlert, Activity, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { emergencyStop } from '@/lib/api';

interface PulseHeaderProps {
  pulse: {
    status: 'ACTIVE' | 'IDLE' | 'STOPPED';
    activeTask: string;
    progress?: number;
  };
}

export const PulseHeader: React.FC<PulseHeaderProps> = ({ pulse }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'IDLE': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'STOPPED': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  const handleStop = async () => {
    try {
      await emergencyStop();
    } catch (error) {
      console.error('Failed to stop system:', error);
    }
  };

  return (
    <div className="bg-card/50 border border-border/50 rounded-2xl p-6 backdrop-blur-sm shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-xl border ${getStatusColor(pulse.status)} shadow-inner`}>
          {pulse.status === 'ACTIVE' ? <Loader2 className="animate-spin" size={24} /> : <Activity size={24} />}
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold tracking-tight">System Pulse</h2>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${getStatusColor(pulse.status)}`}>
              {pulse.status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 font-medium">
            {pulse.activeTask || 'No active task'}
          </p>
        </div>
      </div>

      <div className="flex-1 max-w-md w-full">
        <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
          <span>Task Progress</span>
          <span>{pulse.progress || 0}%</span>
        </div>
        <Progress value={pulse.progress || 0} className="h-2 bg-slate-100 dark:bg-slate-800" />
      </div>

      <Button 
        variant="destructive" 
        size="sm" 
        onClick={handleStop}
        className="font-bold uppercase tracking-tighter gap-2 shadow-lg shadow-rose-500/20"
      >
        <ShieldAlert size={16} />
        Emergency Stop
      </Button>
    </div>
  );
};
