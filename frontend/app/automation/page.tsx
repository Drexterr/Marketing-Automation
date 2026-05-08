'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSystemState, toggleModule } from '@/lib/api';
import { ModuleToggle } from '@/components/automation/module-toggle';
import { 
  UserPlus, 
  MessageCircle, 
  ReplyAll, 
  Monitor, 
  Rss, 
  PenTool, 
  Calendar,
  AlertCircle
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const MODULES = [
  { id: 'connect', title: 'Connections', description: 'Auto-send connection requests', icon: UserPlus },
  { id: 'first_message', title: 'First Messages', description: 'Send intro after connection accepted', icon: MessageCircle },
  { id: 'reply_check', title: 'Reply Monitoring', description: 'Check for new incoming messages', icon: Monitor },
  { id: 'auto_reply', title: 'Auto Replies', description: 'AI-generated responses to leads', icon: ReplyAll },
  { id: 'feed_comments', title: 'Feed Engagement', description: 'Auto-comment on relevant posts', icon: Rss },
  { id: 'content_posting', title: 'Content Posting', description: 'Generate and schedule new posts', icon: PenTool },
  { id: 'scheduler', title: 'Master Scheduler', description: 'Global automation time-windows', icon: Calendar },
];

export default function AutomationPage() {
  const queryClient = useQueryClient();

  const { data: state, isLoading, isError } = useQuery({
    queryKey: ['systemState'],
    queryFn: getSystemState,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string, enabled: boolean }) => toggleModule(id, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systemState'] });
    },
  });

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Connection Error</AlertTitle>
        <AlertDescription>
          Could not reach the backend API. Please ensure the automation server is running.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Automation Control</h1>
        <p className="text-muted-foreground mt-1">Enable or disable individual outreach modules in real-time.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {MODULES.map((module) => (
          <ModuleToggle
            key={module.id}
            title={module.title}
            description={module.description}
            icon={module.icon}
            enabled={state?.[`${module.id}_enabled`] ?? false}
            onToggle={(enabled) => toggleMutation.mutate({ id: module.id, enabled })}
            isLoading={isLoading || toggleMutation.isPending}
          />
        ))}
      </div>

      <div className="bg-secondary/30 border border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center text-center">
        <div className="p-3 bg-secondary rounded-full mb-4">
          <AlertCircle className="text-muted-foreground" size={24} />
        </div>
        <h3 className="font-bold text-lg">Safety Protocols Active</h3>
        <p className="text-sm text-muted-foreground max-w-md mt-2">
          All automation adheres to the daily limits and ramp-up progression configured in your system settings.
        </p>
      </div>
    </div>
  );
}
