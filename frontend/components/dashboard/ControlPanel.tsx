'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSystemState, toggleModule, emergencyStop } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Zap, ShieldAlert } from 'lucide-react';

export function ControlPanel() {
  const queryClient = useQueryClient();
  const { data: state } = useQuery({
    queryKey: ['systemState'],
    queryFn: getSystemState,
    refetchInterval: 5000,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ module, enabled }: { module: string; enabled: boolean }) => 
      toggleModule(module, enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['systemState'] }),
  });

  const stopMutation = useMutation({
    mutationFn: emergencyStop,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['systemState'] }),
  });

  const modules = [
    { id: 'connect_enabled', label: 'Connection Engine' },
    { id: 'first_message_enabled', label: 'Outreach Engine' },
    { id: 'feed_enabled', label: 'Feed Monitor' },
  ];

  return (
    <Card className="bg-card/40 border-primary/10">
      <CardHeader>
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Zap size={18} className="text-primary" />
          System Controls
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {modules.map((mod) => (
            <div key={mod.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 border border-border/50">
              <Label htmlFor={mod.id} className="text-sm font-medium">{mod.label}</Label>
              <Switch 
                id={mod.id} 
                checked={!!state?.[mod.id]} 
                onCheckedChange={(checked) => toggleMutation.mutate({ module: mod.id, enabled: checked })}
                disabled={toggleMutation.isPending}
              />
            </div>
          ))}
        </div>
        
        <Button 
          variant="destructive" 
          className="w-full font-bold h-12 gap-2 shadow-lg shadow-destructive/20"
          onClick={() => stopMutation.mutate()}
          disabled={stopMutation.isPending}
        >
          <ShieldAlert size={20} />
          EMERGENCY STOP
        </Button>
      </CardContent>
    </Card>
  );
}
