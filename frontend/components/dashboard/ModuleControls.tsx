'use client';

import React from 'react';
import { Settings2, Power } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toggleModule } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';

interface ModuleControlsProps {
  flags: Record<string, boolean>;
}

export const ModuleControls: React.FC<ModuleControlsProps> = ({ flags }) => {
  const queryClient = useQueryClient();

  const handleToggle = async (module: string, enabled: boolean) => {
    try {
      await toggleModule(module, enabled);
      queryClient.invalidateQueries({ queryKey: ['pulse'] });
    } catch (error) {
      console.error(`Failed to toggle module ${module}:`, error);
    }
  };

  const modules = [
    { id: 'replies', name: 'Reply Detection', description: 'Monitor inbox for new messages' },
    { id: 'followups', name: 'Auto Follow-ups', description: 'Send scheduled follow-up messages' },
    { id: 'connect', name: 'Connection Requests', description: 'Automate new connection outreach' },
    { id: 'feed', name: 'Feed Engagement', description: 'Interact with target prospects feed' },
  ];

  return (
    <div className="bg-card/50 border border-border/50 rounded-2xl p-6 backdrop-blur-sm shadow-sm h-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary/10 rounded-lg text-primary shadow-sm">
          <Settings2 size={20} />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight">Supervisor Controls</h2>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Global Module Management</p>
        </div>
      </div>

      <div className="space-y-4">
        {modules.map((module) => (
          <div key={module.id} className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-card/30 transition-all hover:bg-card/50 group">
            <div className="space-y-0.5">
              <Label htmlFor={module.id} className="text-sm font-bold cursor-pointer">{module.name}</Label>
              <p className="text-[10px] text-muted-foreground font-medium">{module.description}</p>
            </div>
            <Switch 
              id={module.id} 
              checked={flags[`${module.id}_enabled`] ?? false}
              onCheckedChange={(checked) => handleToggle(module.id, checked)}
            />
          </div>
        ))}
      </div>

      <div className="mt-8 pt-6 border-t border-border/50">
        <div className="p-4 rounded-xl bg-slate-950 text-white shadow-2xl relative overflow-hidden group">
            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                    <Power size={14} className="text-emerald-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">System Core</span>
                </div>
                <h3 className="text-sm font-bold mb-1">Autonomous Engine</h3>
                <p className="text-[10px] text-slate-400 font-medium leading-relaxed">System handles rate-limiting and session safety automatically across all active modules.</p>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Power size={100} />
            </div>
        </div>
      </div>
    </div>
  );
};
