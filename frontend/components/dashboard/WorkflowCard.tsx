"use client";

import React, { useState } from 'react';
import { Play, Square, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import { WorkflowStatus, startWorkflow, stopWorkflow } from '@/lib/workflows-api';
import { useSystem } from '@/components/providers/system-provider';

interface WorkflowCardProps {
  workflow: WorkflowStatus;
  onRefresh: () => void;
}

const RISKY_WORKFLOWS = ['connect', 'first-message', 'replies'];

const DESCRIPTIONS: Record<string, string> = {
  'connect':       'Searches LinkedIn for target profiles, scores them with AI, and sends personalised connection requests (max 100/week).',
  'first-message': 'Sends a personalised opening message to new 1st-degree connections who haven\'t been messaged yet.',
  'replies':       'Reads unread conversations and generates contextual replies using AI.',
  'followups':     'Sends follow-up messages to connections that haven\'t responded after a set interval.',
  'feed':          'Scrolls the LinkedIn feed, scores posts for relevance, and leaves thoughtful AI-generated comments (max 10/session).',
  'post':          'Drafts and publishes a LinkedIn post using AI based on your product context.',
  'analytics':     'Pulls engagement and outreach stats into the dashboard.',
};

export function WorkflowCard({ workflow, onRefresh }: WorkflowCardProps) {
  const { state: systemState } = useSystem();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRunning = workflow.status === 'RUNNING';
  const isBlocked = systemState.emergencyStop || systemState.health.status === 'ERROR';
  const isRisky = RISKY_WORKFLOWS.includes(workflow.name);

  const handleStart = async () => {
    if (isRisky && !confirm(`This is a risky workflow (${workflow.name}). Are you sure you want to start it manually?`)) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let params: Record<string, any> | undefined;
      try {
        const wfSettings = JSON.parse(localStorage.getItem(`wf-settings-${workflow.name}`) || '{}');
        if (Object.keys(wfSettings).length > 0) params = wfSettings;
      } catch {}
      await startWorkflow(workflow.name, params);
      onRefresh();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to start workflow');
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    setError(null);
    try {
      await stopWorkflow(workflow.name);
      onRefresh();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to stop workflow');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col p-4 border rounded-xl border-slate-800 bg-slate-900/50 hover:bg-slate-900 transition-colors group">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-semibold text-slate-200 capitalize truncate">
            {workflow.name.replace(/-/g, ' ')}
          </span>
          {isRunning ? (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-[10px] font-bold text-emerald-400 tracking-wider shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              RUNNING
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] font-bold text-slate-400 tracking-wider shrink-0">
              IDLE
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          {isRunning ? (
            <button 
              onClick={handleStop}
              disabled={loading}
              className="p-1.5 text-rose-400 hover:bg-rose-400/10 rounded-md transition-colors disabled:opacity-50"
              title="Stop Workflow"
            >
              <Square size={16} fill="currentColor" />
            </button>
          ) : (
            <button 
              onClick={handleStart}
              disabled={isBlocked || loading}
              className="p-1.5 text-emerald-400 hover:bg-emerald-400/10 rounded-md transition-colors disabled:opacity-50"
              title="Start Workflow"
            >
              <Play size={16} fill="currentColor" />
            </button>
          )}
        </div>
      </div>
      
      {/* Description — expands on hover */}
      {DESCRIPTIONS[workflow.name] && (
        <div className="overflow-hidden max-h-0 group-hover:max-h-16 transition-all duration-300 ease-in-out">
          <p className="text-[11px] text-slate-400 leading-snug pb-2 pt-0">{DESCRIPTIONS[workflow.name]}</p>
        </div>
      )}

      <div className="flex items-center gap-4 text-xs font-mono text-slate-500">
        <div className="flex items-center gap-1.5">
          <Clock size={12} />
          {workflow.lastRunTime !== 'Unknown' && workflow.lastRunTime
            ? new Date(workflow.lastRunTime).toLocaleTimeString()
            : '--:--'}
        </div>
      </div>

      {error && (
        <div className="mt-3 text-[10px] text-rose-400 bg-rose-400/10 p-2 rounded flex items-start gap-1.5">
          <AlertCircle size={12} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
