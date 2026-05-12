'use client';

import React from 'react';
import { Users, MessageSquare, CheckCircle, AlertTriangle } from 'lucide-react';
import { StatCard } from './StatCard';

interface MetricGridProps {
  counters: {
    weeklyConnections: number;
    dailyReplies: number;
    aiFailures: number; // We'll show AI Success rate instead as per requirements
    warnings: number;
  };
}

export const MetricGrid: React.FC<MetricGridProps> = ({ counters }) => {
  // Assuming a static target for AI Success for now or derived from failures
  const aiSuccessRate = counters.aiFailures === 0 ? 100 : Math.max(0, 100 - counters.aiFailures);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard 
        title="Weekly Connections" 
        value={counters.weeklyConnections}
        description="Target: 100/week"
        icon={Users}
        className="bg-card/40 border-primary/10"
      />
      <StatCard 
        title="Daily Replies" 
        value={counters.dailyReplies}
        description="Active follow-ups"
        icon={MessageSquare}
        className="bg-card/40 border-primary/10"
      />
      <StatCard 
        title="AI Success" 
        value={`${aiSuccessRate}%`}
        description="Claude confidence avg"
        icon={CheckCircle}
        className="bg-card/40 border-primary/10"
      />
      <StatCard 
        title="LinkedIn Warnings" 
        value={counters.warnings}
        description="Daily safety limit"
        icon={AlertTriangle}
        className={counters.warnings > 0 ? "bg-rose-500/5 border-rose-500/20" : "bg-card/40 border-primary/10"}
      />
    </div>
  );
};
