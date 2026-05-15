"use client";

import { useSystem } from "@/components/providers/system-provider";
import { AlertTriangle, CheckCircle, XCircle, Activity, Play } from "lucide-react";
import { resumeSystem } from "@/lib/api";
import { useState } from "react";

export function SystemHealthBanner() {
  const { state, refresh } = useSystem();
  const { health, pulse, emergencyStop } = state;
  const [loading, setLoading] = useState(false);

  const handleResume = async () => {
    setLoading(true);
    try {
      await resumeSystem();
      await refresh();
    } catch (error) {
      console.error("Failed to resume system:", error);
    } finally {
      setLoading(false);
    }
  };

  if (emergencyStop) {
    return (
      <div className="w-full bg-rose-500/10 border-b border-rose-500/20 px-6 py-2 flex items-center gap-3">
        <AlertTriangle className="text-rose-500 h-5 w-5" />
        <span className="text-rose-500 font-medium text-sm">
          SYSTEM EMERGENCY STOP ACTIVE
        </span>
        <button
          onClick={handleResume}
          disabled={loading}
          className="ml-4 px-3 py-1 bg-rose-500 text-white text-xs font-bold rounded-md hover:bg-rose-600 transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <Play size={12} fill="currentColor" />
          RESUME SYSTEM
        </button>
        <span className="text-rose-500/70 text-xs ml-auto">
          All automated workflows are currently blocked.
        </span>
      </div>
    );
  }

  if (health.status === 'ERROR') {
    return (
      <div className="w-full bg-rose-500/10 border-b border-rose-500/20 px-6 py-2 flex items-center gap-3">
        <XCircle className="text-rose-500 h-5 w-5" />
        <span className="text-rose-500 font-medium text-sm">
          SYSTEM ERROR
        </span>
        <span className="text-rose-500/70 text-xs ml-auto flex gap-4">
          {!health.details.dbHealthy && <span>DB Connection Failed</span>}
          {health.details.schedulerFailures >= 5 && <span>Scheduler Failing</span>}
        </span>
      </div>
    );
  }

  if (health.status === 'DEGRADED') {
    return (
      <div className="w-full bg-amber-500/10 border-b border-amber-500/20 px-6 py-2 flex items-center gap-3">
        <AlertTriangle className="text-amber-500 h-5 w-5" />
        <span className="text-amber-500 font-medium text-sm">
          SYSTEM DEGRADED
        </span>
        <span className="text-amber-500/70 text-xs ml-auto flex gap-4">
          {health.details.claudeDegraded && <span>Claude API Degraded</span>}
          {health.details.schedulerFailures > 0 && <span>Scheduler Retrying</span>}
        </span>
      </div>
    );
  }

  return (
    <div className="w-full bg-emerald-500/5 border-b border-emerald-500/10 px-6 py-2 flex items-center gap-3">
      <CheckCircle className="text-emerald-500 h-5 w-5" />
      <span className="text-emerald-500 font-medium text-sm">
        SYSTEM HEALTHY
      </span>
      {pulse.status === 'RUNNING' && (
        <div className="flex items-center gap-2 ml-4 px-2 py-0.5 bg-emerald-500/10 rounded text-emerald-400 text-xs font-mono">
          <Activity className="h-3 w-3 animate-pulse" />
          ACTIVE: {pulse.activeTask}
        </div>
      )}
      <span className="text-slate-500 text-xs ml-auto font-mono">
        {pulse.lastHeartbeat ? `Last Pulse: ${new Date(pulse.lastHeartbeat).toLocaleTimeString()}` : 'Awaiting pulse...'}
      </span>
    </div>
  );
}
