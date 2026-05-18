"use client";

import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchWorkflowsStatus } from '@/lib/workflows-api';
import { WorkflowCard } from './WorkflowCard';
import { Activity, RefreshCcw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export function WorkflowControlCenter() {
  const { data: workflows, isLoading, error, refetch } = useQuery({
    queryKey: ['workflows-status'],
    queryFn: fetchWorkflowsStatus,
    refetchInterval: 3000,
  });

  if (error) {
    return (
      <div className="bg-card/50 border border-border/50 rounded-2xl p-6">
        <p className="text-rose-500 text-sm">Failed to load workflows: {(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="bg-card/50 border border-border/50 rounded-2xl p-6 backdrop-blur-sm shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400 shadow-sm">
            <Activity size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Workflow Control</h2>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Manual Trigger Center</p>
          </div>
        </div>
        <button 
          onClick={() => refetch()} 
          className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-200"
          title="Refresh Status"
        >
          <RefreshCcw size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 content-start overflow-auto pr-2">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))
        ) : (
          workflows?.map(workflow => (
            <WorkflowCard 
              key={workflow.name} 
              workflow={workflow} 
              onRefresh={() => refetch()} 
            />
          ))
        )}
      </div>
    </div>
  );
}
